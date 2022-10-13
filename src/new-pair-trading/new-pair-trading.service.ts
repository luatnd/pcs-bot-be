import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';
import { TradingIntendStatus } from '../prisma/@generated/graphql/prisma/trading-intend-status.enum';
import { TradingIntendCreateInput } from '../prisma/@generated/graphql/trading-intend/trading-intend-create.input';
import { TradingIntendType } from '../prisma/@generated/graphql/prisma/trading-intend-type.enum';
import { DtExchange, DtPair, DtPairDynamicData } from '../pair-info/type/dextool';
import { AppSwapOption, PancakeswapV2Service } from '../pancakeswap-v2/pancakeswap-v2.service';
// eslint-disable-next-line max-len
import { PairDynamicDataCreateInput } from '../prisma/@generated/graphql/pair-dynamic-data/pair-dynamic-data-create.input';
import { PrismaErrorCode } from '../prisma/const';
import { TradingIntend } from '../prisma/@generated/graphql/trading-intend/trading-intend.model';
import { Pair } from '../prisma/@generated/graphql/pair/pair.model';
import { AppError } from '../../libs/errors/base.error';
import { CommonBscQuoteAddress, CommonBscQuoteSymbol } from '../pair-realtime-data/const/CommonBSCSymbol';
// eslint-disable-next-line max-len
import { TradingDirectiveAutoConfig } from '../prisma/@generated/graphql/trading-directive-auto-config/trading-directive-auto-config.model';
import { PairRealtimeDataService } from '../pair-realtime-data/pair-realtime-data.service';
import { TradeHistoryStatus } from '../prisma/@generated/graphql/prisma/trade-history-status.enum';
import { ethers } from 'ethers';

type PairId = string;

@Injectable()
export class NewPairTradingService {
  private readonly logger = new Logger(NewPairTradingService.name);

  // Simple cache using hash map
  private activeTradingPairs: Map<PairId, true> = new Map<PairId, true>();

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private pancakeswapV2Service: PancakeswapV2Service,
    private pairRealtimeDataService: PairRealtimeDataService,
  ) {}

  @OnEvent('lp.created', { async: true })
  async handleLpCreatedEvent(payload: PairCreateInput) {
    if (payload.exchange_id != DtExchange.pancakev2) {
      this.logger.warn('Support pancakev2 only, got: ' + payload.exchange_id);
      return;
    }

    /*
     Receive event from pair-info module, then:
     - Start to follow
     */
    this.logger.log('{handleLpCreatedEvent} : ' + payload.id);

    const d = payload.data as DtPairDynamicData;
    const pairDynamicDataRecord: PairDynamicDataCreateInput = {
      pair_id: payload.id,
      initialReserve0: d.initialReserve0, // If pool just created without reverse => initialReserve0 = -1
      initialReserve1: d.initialReserve1, // If pool just created without reverse => initialReserve0 = -1
      initialLiquidity: d.initialLiquidity, // If pool just created without reverse => initialReserve0 = undefined
      initialLiquidityUpdatedAt: d.initialLiquidityUpdatedAt,
      liquidity: d.liquidity,
      reserve0: d.reserve0,
      reserve1: d.reserve1,
      reserveUpdatedAt: d.reserveUpdatedAt,
    };

    // OLD: Stop setup if pair already exist
    // NEW: We can ignore it, because it's not cause any accident
    try {
      await this.prisma.pairDynamicData.create({
        data: pairDynamicDataRecord,
      });
    } catch (e) {
      this.logger.warn('{handleLpCreatedEvent} pairDynamicData.create: e.code, e: ', e.code, e);
      // return;
    }

    this.startNewPairTradingFlow(payload);
  }

  @OnEvent('lp.updated', { async: true })
  async handleLpUpdatedEvent(payload: PairCreateInput) {
    /*
     Receive event from pair-info module
     - check if we can: entry / tp / sl
     */
    if (payload.exchange_id != DtExchange.pancakev2) {
      this.logger.warn('Support pancakev2 only, got: ' + payload.exchange_id);
      return;
    }

    const pairId = payload.id;
    this.logger.log('{handleLpUpdatedEvent} : ' + pairId);

    // update to db
    const d = payload.data as DtPairDynamicData;
    const pairDynamicDataRecord = {
      initialReserve0: d.initialReserve0,
      initialReserve1: d.initialReserve1,
      initialLiquidity: d.initialLiquidity,
      initialLiquidityUpdatedAt: d.initialLiquidityUpdatedAt,
      liquidity: d.liquidity,
      reserve0: d.reserve0,
      reserve1: d.reserve1,
      reserveUpdatedAt: d.reserveUpdatedAt,
    };

    try {
      const r = await this.prisma.pairDynamicData.update({
        where: { pair_id: pairId },
        data: pairDynamicDataRecord,
      });
    } catch (e) {
      if (e.code === PrismaErrorCode.RecordNotFound) {
        return;
      }

      this.logger.error('{handleLpUpdatedEvent} e.code, e: ' + e.code, e);
    }

    let tradingIntent: TradingIntend;
    try {
      tradingIntent = await this.prisma.tradingIntend.findFirst({
        where: {
          pair_id: pairId,
          status: TradingIntendStatus.FindingEntry,
        },
      });

      // try place entry if status = FindingEntry
      if (!!tradingIntent) {
        await this.tryPlaceBuyEntry(payload);
      }
    } catch (e) {}

    try {
      tradingIntent = await this.prisma.tradingIntend.findFirst({
        where: {
          pair_id: pairId,
          status: TradingIntendStatus.FindingExit,
        },
      });

      if (!!tradingIntent) {
        // try tp or sl if status=FindingExit
        await this.tryTp(payload);
        await this.trySl(payload);
      }
    } catch (e) {}
  }

  @OnEvent('lp.price_updated', { async: true })
  async handleLpPriceUpdatedEvent(payload: any) {
    if (payload.exchange_id != DtExchange.pancakev2) {
      this.logger.warn('Support pancakev2 only, got: ' + payload.exchange_id);
      return;
    }

    // TODO:

    const pairId = payload.id;
    this.logger.log('{handleLpUpdatedEvent} : ' + pairId);

    // update to db
    const r = await this.prisma.pairRealtimeQuote.update({
      where: { pair_id: pairId },
      data: {
        // TODO:
        current_price: 0,
        price_impact: 0,
      },
    });

    await this.tryPlaceBuyEntry(payload);
    await this.tryTp(payload);
    await this.trySl(payload);
  }

  async handleLpRugPullOrIgnoreIt(payload: PairCreateInput) {
    // TODO: Listen to LP update event then if LP is too low then disable it from pair table
    // Add pairs.status
  }

  /**
   * TODO:
   *
   * Flow:
   * - got the news => which contract / symbol / pair will be trade => choose contract
   * - system will only trade on this pair
   * - System catch the LP created event
   * - System catch the LP updated event
   * - System place an order
   * - System exit the order if x2
   */
  setupPairTradingFlow(contractAddress: string) {
    this.prisma.tradingDirectiveRedListContract.create({
      data: {
        contract: contractAddress,
      },
    });
  }

  async startNewPairTradingFlow(p: PairCreateInput) {
    // track price for this pair
    // place entry
    //  - setup SL
    //  - setup TP
    await this.createTradingIntend(p);
    await this.setupPriceTracking(p);
    await this.tryPlaceBuyEntry(p);
  }

  async createTradingIntend(p: PairCreateInput) {
    const existIntend = await this.prisma.tradingIntend.findFirst({
      where: {
        pair_id: p.id,
        status: TradingIntendStatus.FindingEntry,
      },
    });
    if (existIntend !== null) {
      this.logger.warn('{createTradingIntend} Skip creation: TradingIntend FindingEntry already exist for: ' + p.id);
      return existIntend;
    }

    const tradingIntend: TradingIntendCreateInput = {
      pair_id: p.id,
      type: TradingIntendType.Auto,
      vol: null,
      entry: null,
      tp: null,
      sl: null,
      status: TradingIntendStatus.FindingEntry,
    };
    return this.prisma.tradingIntend.create({ data: tradingIntend });
  }

  isActiveTradingPair(pairId: string) {
    return this.activeTradingPairs.has(pairId);
  }

  setActiveTradingPair(pairId: string, active: boolean) {
    if (active) {
      this.activeTradingPairs.set(pairId, true);
    } else {
      this.activeTradingPairs.delete(pairId);
    }
  }

  setupPriceTracking(p: PairCreateInput) {
    // all intend with TradingIntendStatus=FindingEntry/FindingExit are needed to track price
    // Add this to active trading pair cache
    this.setActiveTradingPair(p.id, true);
  }

  removePriceTracking(p: PairCreateInput) {
    // Remove this from active trading pair cache
    this.setActiveTradingPair(p.id, false);
  }

  /**
   * @NOTE:
   *
   *  RULE:
   *    The pair is XXX/BUSD => base = XXX, quote = BUSD
   *    The pair is BUSD/XXX => base = BUSD, quote = XXX
   *                         => Will be swap to: base = XXX, quote = BUSD
   *
   *  We alway consider XXX is the project we want to buy, it's always `base`,
   *                    BUSD is the common token we're holding & want to sell, it's `quote`
   *
   * @NOTE:
   *  BUY mean we trade `quote` to get `base` => give BUSD and get XXX
   *  SELL mean we trade `base` to get `quote` => give XXX and get BUSD
   */
  async tryPlaceBuyEntry(p: PairCreateInput, tradingIntent?: TradingIntend) {
    if (!this.isActiveTradingPair(p.id)) {
      this.logger.debug('Not isActiveTradingPair: ' + p.id);
      return;
    }

    // Only place entry for: status = FindingEntry
    try {
      tradingIntent = await this.validateTradingIntend(p, tradingIntent);
    } catch (e) {
      this.logger.error('{tryPlaceEntry.validateTradingIntend} e.code: ' + e.code, e);
      return;
    }

    // LP must be big enough
    let lpInfo: {
      tradingDirectiveAutoConfig: TradingDirectiveAutoConfig;
      lpSizeUsd: number;
      minLpSizeUsd: number;
    };
    try {
      lpInfo = await this.validateLpSize(p);
    } catch (e) {
      this.logger.error('{tryPlaceEntry.validateLpSize} e.code: ' + e.code, e);
      return;
    }
    const { tradingDirectiveAutoConfig, lpSizeUsd, minLpSizeUsd } = lpInfo;

    // ---- get realtime quote -----
    const pData = p.data as DtPair;
    const { baseSortedIdx: bi, quoteSortedIdx: qi } = this.getSortedIdx(pData);
    if (bi === -1) {
      this.logger.warn('{tryPlaceEntry} SKIP because no token pair is common quote token');
      return;
    }
    // const bi = 1, qi = 0; // FAKE: this code for debug only

    const baseTokenData = pData['token' + bi]; // Can be token0 or token1
    const quoteTokenData = pData['token' + qi]; // Can be token0 or token1
    const baseReserve = pData['reserve' + bi];
    const quoteReserve = pData['reserve' + qi];
    // const baseInitialReserve = pData.initialReserve0;
    // const quoteInitialReserve = pData.initialReserve1;
    console.log('{tryPlaceBuyEntry} [bi, qi]: ', [bi, qi]);

    // eslint-disable-next-line max-len
    const base = this.pancakeswapV2Service.getAppToken(
      baseTokenData.id,
      baseTokenData.decimals,
      baseTokenData.symbol,
      baseTokenData.name,
    );
    // eslint-disable-next-line max-len
    const quote = this.pancakeswapV2Service.getAppToken(
      quoteTokenData.id,
      quoteTokenData.decimals,
      quoteTokenData.symbol,
      quoteTokenData.name,
    );

    // This volume is for get quotes only, we will not trade using this vol
    let amountOfOwningTokenWeAttemptToSell = 0;
    try {
      // we're going to buy Base, sell quote token, mean swap [quote => base]
      amountOfOwningTokenWeAttemptToSell = await this.maxPossibleTradingVol(
        tradingDirectiveAutoConfig,
        quoteTokenData,
        baseReserve,
        quoteReserve,
        lpSizeUsd,
      );
      // amountOfOwningTokenWeAttemptToSell = 50; // FAKE: this is for debug only
    } catch (e) {
      this.logger.error('{tryPlaceEntry} Cannot choose trading vol: code, message, e: ' + e.code + ' ' + e.message);
      this.logger.error(e); // This is how to log to file logger
      console.error(e); // This is only way to log this error to console
      return;
    }

    // quoteTokenAmountToSell in token, force min(5% LP, $500) to get quotes
    const quoteTokenAmountToSell = amountOfOwningTokenWeAttemptToSell;
    const MAX_PRICE_IMPACT = 10 / 100;
    const denom = this.pancakeswapV2Service.SLIPPAGE_DENOMINATOR; // denominator is 10k in PcsV2 service
    const slippageTolerant = Math.floor(MAX_PRICE_IMPACT * denom).toString();
    const quotes = await this.pancakeswapV2Service.getQuotation(
      base,
      quote,
      quoteTokenAmountToSell.toString(),
      slippageTolerant,
    );
    this.logger.log('{tryPlaceEntry} quotes: ', {
      trade: '... => Complex object',
      midPrice: quotes.midPrice.toSignificant(),
      executionPrice: quotes.executionPrice.toSignificant(),
      nextMidPrice: quotes.nextMidPrice.toSignificant(),
      priceImpact: quotes.priceImpact.toSignificant(),
      minimumAmountOut: quotes.minimumAmountOut,
      // number of token amount of base in LP
      pooledTokenAmount0: quotes.pooledTokenAmount0,
      // number of token amount of quote in LP
      pooledTokenAmount1: quotes.pooledTokenAmount1,
      // 1 base = x quote
      token0Price: quotes.token0Price,
      // 1 quote = x base
      token1Price: quotes.token1Price,
    });

    // sell price
    const executionPrice = Number(quotes.executionPrice.toSignificant());
    const currentPrice = Number(quotes.midPrice.toSignificant());
    const nextMidPrice = Number(quotes.nextMidPrice.toSignificant());
    const priceImpactPercent = Number(quotes.priceImpact.toSignificant());

    const MIN_PRICE_DELTA_FOLD = 5;

    // const initialListingPrice = 1;
    // // current_price/initial_listing_price <= 5
    // if (currentPrice / initialListingPrice > MIN_PRICE_DELTA_FOLD) {
    //   this.logger.warn(
    //     `SKIP: because of price go to far: currentPrice=${currentPrice} initialListingPrice=${initialListingPrice}`,
    //   );
    //   return;
    // }
    this.logger.verbose('{tryPlaceEntry} priceImpactPercent, maxAllowed: ', priceImpactPercent, MAX_PRICE_IMPACT * 100);

    // price_impact <= 10%
    if (priceImpactPercent > MAX_PRICE_IMPACT * 100) {
      this.logger.warn(`SKIP: because of priceImpact=${priceImpactPercent} larger than ${MAX_PRICE_IMPACT * 100}%`);
      return;
    }

    // if all cond met => Create order:
    let swapResult;
    const opt: AppSwapOption = {};
    if (tradingDirectiveAutoConfig.fixed_gas_price_in_gwei) {
      opt.gasPrice = tradingDirectiveAutoConfig.fixed_gas_price_in_gwei * 1e9;
    }
    try {
      swapResult = await this.pancakeswapV2Service.swapTokensWithTradeObject(
        quotes.trade,
        quotes.minimumAmountOut,
        base,
        quote,
        opt,
      );
    } catch (e) {
      this.logger.error(`swapTokensWithTradeObject: e: `, e);
      console.error(e); // This is only way to log this error to console
      return;
    }

    const createEntrySucceed = !!swapResult;
    if (createEntrySucceed) {
      try {
        this.setupTP(p);
        this.setupSL(p);
      } catch (e) {
        this.logger.error(`setup TP/SL: e: `, e);
      }
    }

    // Save to trade history
    try {
      // @ts-ignore
      const buyPrice = 1 / executionPrice;
      // const estimatedTokenReceived = ethers.utils.formatUnits(quotes.minimumAmountOut, quote.decimals);
      // It's approximately amount, not strict equal
      // sellAmount * sellPrice = sellAmount * (1 / buyPrice)
      const estimatedTokenReceived = quoteTokenAmountToSell / buyPrice;
      await this.prisma.tradeHistory.create({
        data: {
          sell: quote.symbol,
          buy: base.symbol,
          sell_amount: quoteTokenAmountToSell,
          received_amount: Number(estimatedTokenReceived),
          price: buyPrice, // 1 base = ? quote
          price_impact_percent: Number(quotes.priceImpact.toSignificant()),
          status: TradeHistoryStatus.S,
          duration: swapResult.duration,
          receipt: swapResult,
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradeHistory.inserted: ');

      await this.prisma.tradingIntend.update({
        where: { id: tradingIntent.id },
        data: {
          // NOTE: When you sell all, note that this is not 100% correct number
          // It's estimated, luckily it's might always smaller number than actual? => plz check
          vol: Number(estimatedTokenReceived),
          entry: buyPrice,
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradingIntend.updated: ');
    } catch (e) {
      this.logger.error('tradeHistory.create: e: ', e);
    }

    // TODO: Handle the case we don't have any quote balance,
    //    eg: we wanna trade HERO/USDT but no USDT left

    // TODO: Can sometime accidentally sell all quotes?
    //  => Need to verify and never sellQuotes in FindingExit phase
  }

  /**
   * Determine the index of the project token is base token,
   *  and the quote token must be popular token like: BUSD, BNB, USDT
   */
  private getSortedIdx(pairData: DtPair): { quoteSortedIdx: number; baseSortedIdx: number } {
    const pData: DtPair = { ...pairData };

    let baseSortedIdx = -1;
    let quoteSortedIdx = -1;

    /**
     * Ensure base token is the token of the project
     * If base is common quote then swap it
     */
    if (pData.token0.id.toLowerCase() in CommonBscQuoteAddress) {
      this.logger.warn('{getSortedIdx} pair.token0 is known common quote symbol');
      baseSortedIdx = 1;
      quoteSortedIdx = 0;
    } else if (pData.token1.id.toLowerCase() in CommonBscQuoteAddress) {
      this.logger.warn('{getSortedIdx} pair.token1 is known common quote symbol');
      baseSortedIdx = 0;
      quoteSortedIdx = 1;
    } else {
      this.logger.warn('{getSortedIdx} No token is known for common quote symbol');
    }

    // TODO: Handle the case we don't have any quote balance,
    //    eg: we wanna trade HERO/USDT but no USDT left

    return {
      baseSortedIdx,
      quoteSortedIdx,
    };
  }

  private async validateTradingIntend(p: PairCreateInput, tradingIntent?: TradingIntend) {
    if (!tradingIntent) {
      try {
        tradingIntent = await this.prisma.tradingIntend.findFirst({
          where: {
            pair_id: p.id,
            status: TradingIntendStatus.FindingEntry,
          },
        });
      } catch (e) {
        // this.logger.error('{tryPlaceEntry} e.code: ' + e.code, e);
        this.logger.warn(
          '{tryPlaceEntry} SKIP: Cannot find tradingIntent FindingEntry pair for: ' + p.id + ' with error:',
          e.code,
          e,
        );

        throw e;
      }
    }

    // null = not found
    if (!tradingIntent) {
      // this.logger.warn('{tryPlaceEntry} SKIP: Cannot find tradingIntent FindingEntry pair for: ' + p.id);
      // return;
      throw new AppError(
        '{tryPlaceEntry} SKIP: Cannot find tradingIntent FindingEntry pair for: ' + p.id,
        'TradingIntendStatus.FindingEntry.NotFound',
      );
    }

    if (tradingIntent.status != TradingIntendStatus.FindingEntry) {
      // eslint-disable-next-line max-len
      // this.logger.warn(
      //   '{tryPlaceEntry} SKIP: tradingIntent.status != FindingEntry: ' + p.id + ' ' + tradingIntent.status,
      // );
      // return;
      throw new AppError(
        '{tryPlaceEntry} SKIP: tradingIntent.status != FindingEntry: ' + p.id + ' ' + tradingIntent.status,
        'TradingIntendStatus.FindingEntry.NotEqual',
      );
    }

    return tradingIntent;
  }

  // LP must be big enough
  private async validateLpSize(p: PairCreateInput) {
    const tradingDirectiveAutoConfig = await this.prisma.tradingDirectiveAutoConfig.findFirst();
    if (tradingDirectiveAutoConfig === null) {
      // this.logger.error("SKIP: tradingDirectiveAutoConfig not exist");
      // return;
      throw new AppError('SKIP: tradingDirectiveAutoConfig not exist', 'MissingDbConfig');
    }
    const minPairBudgetInUsd = tradingDirectiveAutoConfig.min_pair_budget_usd.toNumber();
    // const maxPairBudgetInUsd = tradingDirectiveAutoConfig.max_pair_budget_usd.toNumber();
    /**
     * trading vol must be <= 10% of LP <=> So LP must be big enough
     * safeLpSizeUsd=100k mean sth like if a pair has 100K USD in its LP, it's likely not a rug pool pair
     */
    const safeLpSizeUsd = tradingDirectiveAutoConfig.safe_lp_size_usd.toNumber();
    // eslint-disable-next-line camelcase
    const minLpSizeUsd_ByMinTrade = (minPairBudgetInUsd / 10) * 100; // Hard code max trade <= 10% of LP
    const minLpSizeUsd = Math.max(safeLpSizeUsd, minLpSizeUsd_ByMinTrade);

    const lpSizeUsd = (p.data as DtPairDynamicData).liquidity; // or can get LP from router quotation
    this.logger.debug('{tryPlaceEntry} lpSizeUsd: ' + lpSizeUsd);

    // TODO: Turn this on for production, comment this for debug
    // if (lpSizeUsd < minLpSizeUsd) {
    //   // this.logger.warn("SKIP: LP is not big enough: " + `Actual:${lpSizeUsd}USD < Expect:${minLpSizeUsd}USD`);
    //   // return;
    //   throw new AppError(
    //     'SKIP: LP is not big enough: ' + `Actual:${lpSizeUsd}USD < Expect:${minLpSizeUsd}USD`,
    //     'LpTooSmall',
    //   );
    // }

    return {
      tradingDirectiveAutoConfig,
      lpSizeUsd,
      minLpSizeUsd,
    };
  }

  async maxPossibleTradingVol(
    tradingDirectiveAutoConfig,
    sellTokenData,
    buyTokenReserve,
    sellTokenReserve,
    lpSizeUsd,
  ): Promise<number> {
    const maxPairBudgetInUsd = tradingDirectiveAutoConfig.max_pair_budget_usd.toNumber();
    const minPairBudgetInUsd = tradingDirectiveAutoConfig.min_pair_budget_usd.toNumber();

    // Cond 1: min_pair_budget_usd <= trading vol must be <= max_pair_budget_usd
    // Cond 2: trading vol must be <= 5% of Lp size, Eg: trading vol cannot exceed 5% of LP
    const maxVolPercentOfLp = tradingDirectiveAutoConfig.max_vol_percent_of_lp.toNumber();
    const maxVolBaseOnLp = (lpSizeUsd * maxVolPercentOfLp) / 100;

    const maxVolInUsd = Math.min(maxPairBudgetInUsd, maxVolBaseOnLp);
    if (maxVolInUsd < minPairBudgetInUsd) {
      throw new AppError(
        `maxVolInUsd < minPairBudgetInUsd: ${maxVolInUsd} < ${minPairBudgetInUsd}`,
        'MaxVolUsdTooSmall',
      );
    }

    // eslint-disable-next-line max-len
    const sellTokenPriceUsd = await this.pairRealtimeDataService.getSymbolPriceUsd(
      sellTokenData.symbol,
      this.pancakeswapV2Service.getChainId(),
      sellTokenData.id,
    );
    if (sellTokenPriceUsd === null) {
      throw new AppError('Cannot get sellTokenPriceUsd from pairRealtimeDataService', 'CannotGetSymbolPrice');
    }
    // This is unsafe calculation
    // normally base value and quote value need to be the same
    // So quote_token_in_lp * quote_price ~= base_token_in_lp * base_price
    // const estimatedBuyPriceUsd = (sellTokenReserve * sellTokenPriceUsd) / buyTokenReserve;
    // const maxBuyTokenVolumnInToken = maxVolInUsd / estimatedBuyPriceUsd; // NOTE: sell `quote` to buy `base`
    const maxSellTokenAmount = maxVolInUsd / sellTokenPriceUsd; // NOTE: sell `quote` to buy `base`

    return maxSellTokenAmount;
  }

  tryTp(p: PairCreateInput) {
    // TODO
  }

  trySl(p: PairCreateInput) {
    // TODO
  }

  setupTP(p: PairCreateInput) {
    // TODO
  }

  setupSL(p: PairCreateInput) {
    // do it manually by firing a graphql mutation to set up SL
    // TODO
  }

  stopNewPairTradingFlow(p: PairCreateInput) {
    this.removePriceTracking(p);

    // TODO:
  }

  async getPairById(pairId: string): Promise<Pair> {
    return this.prisma.pair.findUnique({ where: { id: pairId } });
  }
}
