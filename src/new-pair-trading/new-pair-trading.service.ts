import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';
import { TradingIntendStatus } from '../prisma/@generated/graphql/prisma/trading-intend-status.enum';
import { TradingIntendCreateInput } from '../prisma/@generated/graphql/trading-intend/trading-intend-create.input';
import { TradingIntendType } from '../prisma/@generated/graphql/prisma/trading-intend-type.enum';
import { DtExchange, DtPairDynamicData } from '../pair-info/type/dextool';
import { PancakeswapV2Service } from '../pancakeswap-v2/pancakeswap-v2.service';
// eslint-disable-next-line max-len
import { PairDynamicDataCreateInput } from '../prisma/@generated/graphql/pair-dynamic-data/pair-dynamic-data-create.input';
import { PrismaErrorCode } from '../prisma/const';
import { TradingIntend } from '../prisma/@generated/graphql/trading-intend/trading-intend.model';
import { Pair } from '../prisma/@generated/graphql/pair/pair.model';

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
      initialReserve0: d.initialReserve0,
      initialReserve1: d.initialReserve1,
      initialLiquidity: d.initialLiquidity,
      initialLiquidityUpdatedAt: d.initialLiquidityUpdatedAt,
      liquidity: d.liquidity,
      reserve0: d.reserve0,
      reserve1: d.reserve1,
      reserveUpdatedAt: d.reserveUpdatedAt,
    };

    // throw then exit => Stop setup if pair already exist
    // const r =
    await this.prisma.pairDynamicData.create({
      data: pairDynamicDataRecord,
    });

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
        await this.tryPlaceEntry(payload);
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

    await this.tryPlaceEntry(payload);
    await this.tryTp(payload);
    await this.trySl(payload);
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
    await this.tryPlaceEntry(p);
  }

  async createTradingIntend(p: PairCreateInput) {
    const existIntend = this.prisma.tradingIntend.findFirst({
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

  async tryPlaceEntry(p: PairCreateInput, tradingIntent?: TradingIntend) {
    if (!this.isActiveTradingPair(p.id)) {
      this.logger.debug('Not isActiveTradingPair: ' + p.id);
      return;
    }

    // Only place entry for: status = FindingEntry
    if (!tradingIntent) {
      try {
        tradingIntent = await this.prisma.tradingIntend.findFirst({
          where: {
            pair_id: p.id,
            status: TradingIntendStatus.FindingEntry,
          },
        });

        // null = not found
        if (!tradingIntent) {
          this.logger.warn('{tryPlaceEntry} SKIP: Cannot find tradingIntent FindingEntry pair for: ' + p.id);
          return;
        }
      } catch (e) {
        this.logger.error('{tryPlaceEntry} e.code: ' + e.code, e); // TODO: comment out this log
        this.logger.warn('{tryPlaceEntry} SKIP: Cannot find tradingIntent FindingEntry pair for: ' + p.id);
        return;
      }
    }

    if (tradingIntent.status != TradingIntendStatus.FindingEntry) {
      // eslint-disable-next-line max-len
      this.logger.warn(
        '{tryPlaceEntry} SKIP: tradingIntent.status != FindingEntry: ' + p.id + ' ' + tradingIntent.status,
      );
      return;
    }

    // LP must be big enough
    const lpSizeInToken = (p.data as DtPairDynamicData).liquidity;
    const lpSizeUsd = lpSizeInToken; // TODO: Check it

    const tradingDirectiveAutoConfig = await this.prisma.tradingDirectiveAutoConfig.findFirst();
    if (tradingDirectiveAutoConfig === null) {
      this.logger.error('SKIP: tradingDirectiveAutoConfig not exist');
      return;
    }
    const minLpSizeUsd = tradingDirectiveAutoConfig.pair_budget_usd.toNumber();

    if (lpSizeUsd < minLpSizeUsd) {
      this.logger.warn('SKIP: LP is not big enough: ' + `Actual:${lpSizeUsd}USD < Expect:${minLpSizeUsd}USD`);
      return;
    }

    console.log('{tryPlaceEntry} STOP here: ');
    return;

    // get realtime quote
    // TODO:
    const base = null;
    const quote = null;
    const amount = null; // amount in token
    const MIN_PRICE_IMPACT = 10 / 100;
    const slippageTolerant = Math.floor(MIN_PRICE_IMPACT * 10000).toString(); // denominator is 10k in PcsV2 service
    const quotes = await this.pancakeswapV2Service.getQuotation(base, quote, amount, slippageTolerant);

    console.log('{NewPairTradingService.tryPlaceEntry} quotes: ', quotes);

    const currentPrice = Number(quotes.executionPrice);
    const priceImpact = Number(quotes.priceImpact);
    const initialListingPrice = 1;
    // END: TODO

    const MIN_PRICE_DELTA_FOLD = 5;
    // current_price/initial_listing_price <= 5
    if (currentPrice / initialListingPrice > MIN_PRICE_DELTA_FOLD) {
      this.logger.warn(
        `SKIP: because of price go to far: currentPrice=${currentPrice} initialListingPrice=${initialListingPrice}`,
      );
      return;
    }
    // price_impact <= 10%
    if (priceImpact > MIN_PRICE_IMPACT) {
      this.logger.warn(`SKIP: because of priceImpact=${priceImpact} larger than ${MIN_PRICE_DELTA_FOLD * 100}%`);
      return;
    }

    // if all cond met => Create order:
    // TODO:
    const MAX_VOL_PERCENT_BASE_ON_LP = 5;
    const tradingVol = (lpSizeInToken * MAX_VOL_PERCENT_BASE_ON_LP) / 100;
    const swapResult = await this.pancakeswapV2Service.swapExactETHForTokenWithTradeObject(
      quotes.trade,
      quotes.minimumAmountOut,
      base,
      quote,
    );

    // TODO:
    const createEntrySucceed = false;
    if (createEntrySucceed) {
      this.setupTP(p);
      this.setupSL(p);
    }
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
