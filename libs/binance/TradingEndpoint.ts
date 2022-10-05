import {
  ErrorCodes as BinanceErrorCode,
  NewOrderSpot as BinanceNewOrderSpot,
  Order as BinanceOrderResponse,
} from 'binance-api-node';

/**
 * Standard Interface for all broker: Binance, FTX, Houbi, ...
 */
export interface TradingEndpoint {
  it_work: () => Promise<boolean>;

  /**
   * Create new order
   */
  order: (order: OrderInput, dry_run: boolean) => Promise<OrderResponse | EndpointError>;
}

export type OrderInput = BinanceNewOrderSpot;

export type OrderResponse = BinanceOrderResponse;

export type EndpointErrorCode = BinanceErrorCode;

export type EndpointError = {
  code: EndpointErrorCode;
  message: string;
  e: any;
};
