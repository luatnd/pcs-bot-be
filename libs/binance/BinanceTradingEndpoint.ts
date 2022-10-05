/* eslint-disable */
import Binance, {
  Account,
  ErrorCodes,
  ExchangeInfo,
  NewOcoOrder,
  NewOrderSpot,
  OcoOrder,
  QueryOrderResult,
  SymbolFilter,
  SymbolLotSizeFilter,
  SymbolMinNotionalFilter,
  SymbolPriceFilter,
} from 'binance-api-node';
import { EndpointError, OrderInput, OrderResponse, TradingEndpoint } from './TradingEndpoint';
import BigNumber from 'bignumber.js';
import { AppError } from '../errors/base.error';

class BinanceTradingEndpoint implements TradingEndpoint {
  public client;
  public ready = false;
  public usdt_balance;

  // symbol: ExchangeInfo
  public exchange_info_cache: Record<string, ExchangeInfo> = {};

  private static instance: BinanceTradingEndpoint;

  /**
   * The Singleton's constructor should always be private to prevent direct
   * construction calls with the `new` operator.
   */
  private constructor() {
    // env is loaded lazily, so we need to init client lazy also,
    // that's why we use this kind of singleton

    // Authenticated client, can make signed calls
    this.client = Binance({
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
      // getTime: xxx,
    });

    this.it_work().then((worked) => {
      if (worked) {
        console.log('{BinanceTradingEndpoint} Connected');
      } else {
        console.error('{BinanceTradingEndpoint} NOT Connected, Binance will not work!');
      }
    });

    this.refresh_usdt_balance().then(() => {
      this.ready = true;
    });
  }

  /**
   * The static method that controls the access to the singleton instance.
   *
   * This implementation let you subclass the Singleton class while keeping
   * just one instance of each subclass around.
   */
  public static getInstance(): BinanceTradingEndpoint {
    if (!BinanceTradingEndpoint.instance) {
      BinanceTradingEndpoint.instance = new BinanceTradingEndpoint();
    }

    return BinanceTradingEndpoint.instance;
  }

  async it_work(): Promise<boolean> {
    // https://github.com/binance-exchange/binance-api-node#time
    const time = await this.client.time();
    return time > 0;
  }

  has_usdt_balance() {
    return this.usdt_balance > 10; // min $10
  }

  async fetch_balance(symbol: string): Promise<number> {
    const account: Account = await this.client.accountInfo();

    for (let i = 0, c = account.balances.length; i < c; i++) {
      const item = account.balances[i];
      if (item.asset === symbol) {
        return parseFloat(item.free);
      }
    }

    return 0;
  }

  async refresh_usdt_balance(): Promise<void> {
    return this.fetch_balance('USDT').then((balance) => {
      if (typeof balance != 'number') {
        throw new AppError('Cannot fetch current balance, please restart the app');
      }
      this.usdt_balance = balance;
      console.log('{BinanceTradingEndpoint.refresh_usdt_balance} balance: ', balance);
    });
  }

  async getPrice(symbol: string): Promise<string> {
    if (!this.ready) {
      throw new AppError('{BinanceTradingEndpoint.getPrice} Endpoint is not ready, plz try again');
    }

    const r = await this.client.prices({ symbol: symbol });
    return r[symbol];
  }

  /**
   * https://github.com/binance-exchange/binance-api-node#order
   *
   * BuyLimit with price more than market => filled with market price
   */
  async order(order: OrderInput, dry_run: boolean): Promise<OrderResponse | EndpointError> {
    if (!this.ready) {
      throw new AppError('{BinanceTradingEndpoint.order} Endpoint is not ready, plz try again');
    }

    if (!this.has_usdt_balance()) {
      return {
        code: ErrorCodes.UNKNOWN,
        message:
          '[APP_ERROR] Not enough USDT balance, this app require at least 10 USDT, current=$' + this.usdt_balance,
        e: 'App error',
      };
    }

    const new_order = this.orderInput2BinanceOrder(order);

    if (dry_run) {
      /*
       // success if null
       // else throw those errors:
       - MIN_NOTIONAL: min trading vol is $10
       - LOT_SIZE: invalid because size or decimal is redundant, eg: 150.2 TRX (~$10) is ok, but 150.2678 is invalid because to much digits
                   this depend on each symbol
                   Must follow the `Minimum Amount Movement` column: https://www.binance.com/en/trade-rule

       - Filter failure: PERCENT_PRICE:

       See all list of filter here:
       https://binance-docs.github.io/apidocs/spot/en/#filters
      */
      const res = await this.client.orderTest(new_order);
      // never to this case because it will throw error instead
      return {
        code: ErrorCodes.UNKNOWN,
        message: 'success because orderTest does not return any output on success',
        e: 'Some error',
      };
    } else {
      try {
        const res = await this.client.order(new_order);
        // console.log("{BinanceTradingEndpoint.order} order res: ", res);
        return res as OrderResponse;
      } catch (e) {
        console.log('{BinanceTradingEndpoint.order} e: ', e);

        const error_code = this.getErrorCode(e);
        return {
          code: error_code,
          message: e.message,
          e: e,
        };
      }
    }
  }

  async orderOco(order: NewOcoOrder): Promise<OcoOrder | EndpointError> {
    if (!this.ready) {
      throw new AppError('{BinanceTradingEndpoint.orderOco} Endpoint is not ready, plz try again');
    }

    if (!this.has_usdt_balance()) {
      return {
        code: ErrorCodes.UNKNOWN,
        message:
          '[APP_ERROR] orderOco: Not enough USDT balance, this app require at least 10 USDT, current=$' +
          this.usdt_balance,
        e: 'App error',
      };
    }

    try {
      const res: OcoOrder = await this.client.orderOco(order);
      return res;
    } catch (e) {
      console.log('{BinanceTradingEndpoint.orderOco} e: ', e);

      const error_code = this.getErrorCode(e);
      return {
        code: error_code,
        message: e.message,
        e: e,
      };
    }
  }

  async fetch_all_open_orders(): Promise<QueryOrderResult[]> {
    return this.client.openOrders({});
    // .then(res => {
    //
    // });
  }

  async fetch_symbol_open_orders(symbol: string): Promise<QueryOrderResult[]> {
    return this.client.openOrders({
      symbol: symbol,
    });
    // .then(res => {
    //
    // });
  }

  // NOTE: this result is not updated frequently
  // So we can cache this result for 4 hours
  private async fetch_symbol_exchange_info(symbol: string): Promise<ExchangeInfo> {
    return this.client
      .exchangeInfo({
        symbol: symbol,
      })
      .then((r) => {
        // cache this
        this.exchange_info_cache[symbol] = r;
      });
  }

  async get_symbol_exchange_info(symbol: string, cache: boolean = true): Promise<ExchangeInfo> {
    // new fetch if force no cache or haven't cached yet
    if (!cache || !(symbol in this.exchange_info_cache)) {
      await this.fetch_symbol_exchange_info(symbol);
    }

    return this.exchange_info_cache[symbol];
  }

  /**
   * Convert universal order into this endpoint Order
   */
  orderInput2BinanceOrder(order: OrderInput): NewOrderSpot {
    // const new_order = {
    //   symbol: "XLMETH",
    //   side: "BUY", // BUY,SELL
    //   type: "LIMIT", // LIMIT, MARKET, STOP, STOP_LOSS_LIMIT, STOP_LOSS_MARKET, TAKE_PROFIT, TAKE_PROFIT_MARKET,
    //   quantity: "100",
    //   price: "0.0002",
    //   // newClientOrderId, // A unique id for the order. Automatically generated if not sent.
    //   newOrderRespType: "RESULT" // Returns more complete info of the order. ACK, RESULT, or FULL
    // };
    return order as NewOrderSpot;
  }

  getErrorCode(e: any): ErrorCodes {
    return e.code;
  }
}

export class BinanceTradingEndpointHelper {
  static async getExchangeFilters(symbol: string) {
    const exchangeInfo = await BinanceTradingEndpoint.getInstance().get_symbol_exchange_info(symbol);
    const symbolInfo = exchangeInfo.symbols[0];
    if (symbolInfo.symbol !== symbol) {
      throw new Error(
        '{BinanceTradingEndpointHelper.get_max_vol} FATAL ERROR: Symbol is different' +
          `symbol, symbolInfo.symbol: ${symbol} ${symbolInfo.symbol}`,
      );
    }

    return symbolInfo.filters;

    /*
    [
        {
          "filterType": "PRICE_FILTER",
          "minPrice": "0.00001000",
          "maxPrice": "1000.00000000",
          "tickSize": "0.00001000"
        },
        {
          "filterType": "PERCENT_PRICE",
          "multiplierUp": "5",
          "multiplierDown": "0.2",
          "avgPriceMins": 5
        },
        {
          "filterType": "LOT_SIZE",
          "minQty": "0.10000000",
          "maxQty": "9000000.00000000",
          "stepSize": "0.10000000"
        },
        {
          "filterType": "MIN_NOTIONAL",
          "minNotional": "10.00000000",
          "applyToMarket": true,
          "avgPriceMins": 5
        },
        {
          "filterType": "ICEBERG_PARTS",
          "limit": 10
        },
        {
          "filterType": "MARKET_LOT_SIZE",
          "minQty": "0.00000000",
          "maxQty": "19685235.74384988",
          "stepSize": "0.00000000"
        },
        {
          "filterType": "MAX_NUM_ORDERS",
          "maxNumOrders": 200
        },
        {
          "filterType": "MAX_NUM_ALGO_ORDERS",
          "maxNumAlgoOrders": 5
        }
      ]
     */
  }

  /**
   * NOTE: The exchange info was cached per every new signal
   */
  private static async getExchangeFilter(symbol: string, filter_name: string): Promise<SymbolFilter> {
    const filters = await BinanceTradingEndpointHelper.getExchangeFilters(symbol);
    let filter: SymbolFilter = filters.find((i) => i.filterType === filter_name);
    if (!filter) {
      return null;
    } else {
      return filter;
    }
  }

  static async get_lot_size_filter(symbol: string): Promise<SymbolLotSizeFilter> {
    const filter = await BinanceTradingEndpointHelper.getExchangeFilter(symbol, 'LOT_SIZE');
    return filter as SymbolLotSizeFilter;
  }

  static async get_price_filter(symbol: string): Promise<SymbolPriceFilter> {
    const filter = await BinanceTradingEndpointHelper.getExchangeFilter(symbol, 'PRICE_FILTER');
    return filter as SymbolPriceFilter;
  }

  static async get_notional_filter(symbol: string): Promise<SymbolMinNotionalFilter> {
    const filter = await BinanceTradingEndpointHelper.getExchangeFilter(symbol, 'MIN_NOTIONAL');
    return filter as SymbolMinNotionalFilter;
  }

  static step_size_2_max_decimal(step_size: number): number {
    return Math.floor(Math.abs(Math.log10(step_size)));
  }
}

export default BinanceTradingEndpoint;
