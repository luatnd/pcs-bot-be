import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';
import { TradingIntendStatus } from '../prisma/@generated/graphql/prisma/trading-intend-status.enum';
import { TradingIntendCreateInput } from '../prisma/@generated/graphql/trading-intend/trading-intend-create.input';
import { TradingIntendType } from '../prisma/@generated/graphql/prisma/trading-intend-type.enum';
import { DtExchange, DtPair, DtPairDynamicData, DTToken } from '../pair-info/type/dextool';
import { AppSwapOption, PancakeswapV2Service } from '../pancakeswap-v2/pancakeswap-v2.service';
// eslint-disable-next-line max-len
import { PairDynamicDataCreateInput } from '../prisma/@generated/graphql/pair-dynamic-data/pair-dynamic-data-create.input';
import { PrismaErrorCode } from '../prisma/const';
import { TradingIntend } from '../prisma/@generated/graphql/trading-intend/trading-intend.model';
import { Pair } from '../prisma/@generated/graphql/pair/pair.model';
import { AppError } from '../../libs/errors/base.error';
import { CommonBscQuoteAddress } from '../pair-realtime-data/const/CommonBSCSymbol';
// eslint-disable-next-line max-len
import { TradingDirectiveAutoConfig } from '../prisma/@generated/graphql/trading-directive-auto-config/trading-directive-auto-config.model';
import { PairRealtimeDataService } from '../pair-realtime-data/pair-realtime-data.service';
import { TradeHistoryStatus } from '../prisma/@generated/graphql/prisma/trade-history-status.enum';
import { ActiveTradingPairs } from './util/ActiveTradingPairs';
import { ValidateQuotation } from './type';
import { round } from '../utils/number';

@Injectable()
export class NewPairTradingService {
  private readonly logger = new Logger(NewPairTradingService.name);

  public activeTradingPairs: ActiveTradingPairs;
  public activeQuoteSymbols: Map<string, true> = new Map();

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private pancakeswapV2Service: PancakeswapV2Service,
    private pairRealtimeDataService: PairRealtimeDataService,
  ) {
    this.activeTradingPairs = new ActiveTradingPairs(prisma);
    this.loadSupportedQuoteSymbols();
  }

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

    const token0Symbol = payload.data?.token0?.symbol;
    const token1Symbol = payload.data?.token1?.symbol;
    const tradeEnabled = this.activeQuoteSymbols.has(token0Symbol) || this.activeQuoteSymbols.has(token1Symbol);
    if (!tradeEnabled) {
      this.logger.debug(`SKIP: ${token0Symbol}/${token1Symbol} no active quote token was enabled`);
      return;
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
        const q = await this.tryTp(payload, tradingIntent);
        await this.trySl(payload, tradingIntent, q);
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

    // const pairId = payload.id;
    // this.logger.log('{handleLpUpdatedEvent} : ' + pairId);
    //
    // // update to db
    // const r = await this.prisma.pairRealtimeQuote.update({
    //   where: { pair_id: pairId },
    //   data: {
    //     // TODO:
    //     current_price: 0,
    //     price_impact: 0,
    //   },
    // });
    //
    // await this.tryPlaceBuyEntry(payload);
    // await this.tryTp(payload);
    // await this.trySl(payload);
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
    this.activeTradingPairs.set(pairId, active);
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
   *
   * And some of the words you need to investigate:
   *  - base/quote
   *  - in/out
   *  - sell/buy
   *  - token0/token1
   */
  async tryPlaceBuyEntry(p: PairCreateInput, tradingIntent?: TradingIntend) {
    if (!this.isActiveTradingPair(p.id)) {
      this.logger.debug('Not isActiveTradingPair: ' + p.id);
      return;
    }

    // Only place entry for: status = FindingEntry
    try {
      tradingIntent = await this.validateTradingIntend(p, tradingIntent, TradingIntendStatus.FindingEntry);
    } catch (e) {
      this.logger.error('{tryPlaceEntry.validateTradingIntend} e.code: ' + e.code, e);
      return;
    }
    // Mark this item as taking entry status,
    // so other request will ignore this pair while we're placing entry
    const purpose = 'entry';
    await this.lockTrade(tradingIntent, purpose);

    const tradingDirectiveAutoConfig = await this.prisma.tradingDirectiveAutoConfig.findFirst();
    if (tradingDirectiveAutoConfig === null) {
      this.logger.error(new AppError('SKIP: tradingDirectiveAutoConfig not exist', 'MissingDbConfig'));
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }

    // LP must be big enough
    let lpInfo: {
      lpSizeUsd: number;
      minLpSizeUsd: number;
    };
    try {
      lpInfo = await this.validateLpSize(p, tradingDirectiveAutoConfig);
    } catch (e) {
      this.logger.error('{tryPlaceEntry.validateLpSize} e.code: ' + e.code, e);
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }
    const { lpSizeUsd, minLpSizeUsd } = lpInfo;

    // ---- get realtime quote -----
    let q: ValidateQuotation;
    try {
      q = await this.validateQuotationForBuyEntry(p, tradingIntent, purpose, tradingDirectiveAutoConfig, lpSizeUsd);
    } catch (e) {
      this.logger.warn(e); // This is how to log to file logger
      console.error(e); // This is only way to log this error to console
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }
    const { base, quote, quotes, maxPriceImpactPercent, tokenAmountToSell } = q;

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

    // sell price: 1 out = ? in
    const executionPrice = Number(quotes.executionPrice.toSignificant());
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
    // eslint-disable-next-line max-len
    this.logger.verbose(
      '{tryPlaceEntry} priceImpactPercent, maxAllowed: ' + `${priceImpactPercent}% ${maxPriceImpactPercent}%`,
    );

    // price_impact <= 10%
    if (priceImpactPercent > maxPriceImpactPercent) {
      // eslint-disable-next-line max-len
      this.logger.warn(`SKIP: because of priceImpact=${priceImpactPercent}% larger than ${maxPriceImpactPercent}%`);
      await this.reverseTradeOnError(tradingIntent, purpose);
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
      await this.reverseTradeOnError(tradingIntent, purpose);
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
      const estimatedTokenReceived = tokenAmountToSell / buyPrice;
      const historyEntry = await this.prisma.tradeHistory.create({
        data: {
          sell: quote.symbol,
          buy: base.symbol,
          sell_amount: tokenAmountToSell,
          received_amount: Number(estimatedTokenReceived),
          base_price: buyPrice, // 1 base = ? quote
          price_impact_percent: Number(quotes.priceImpact.toSignificant()),
          status: TradeHistoryStatus.S,
          duration: swapResult.duration,
          receipt: swapResult,
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradeHistory.inserted: ');

      const ti = await this.prisma.tradingIntend.update({
        where: { id: tradingIntent.id },
        data: {
          // NOTE: When you sell all, note that this is not 100% correct number
          // It's estimated, luckily it's might always smaller number than actual? => plz check
          vol: Number(estimatedTokenReceived),
          entry: buyPrice,
          status: TradingIntendStatus.FindingExit,
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradingIntend.updated: ');

      // NOTE: This event can be transmitted to FE / admin dashboard
      this.eventEmitter.emit('trade.entryCreated', {
        pair: p,
        historyEntry: historyEntry,
        tradingIntent: ti,
      });
    } catch (e) {
      this.logger.error('tradeHistory.create: e: ', e);
    }

    // TODO: Handle the case we don't have any quote balance,
    //    eg: we wanna trade HERO/USDT but no USDT left

    // TODO: Can sometime accidentally sell all quotes?
    //  => Need to verify and never sellQuotes in FindingExit phase
  }

  async validateQuotationForBuyEntry(
    p: PairCreateInput,
    tradingIntent: TradingIntend,
    purpose: 'entry',
    tradingDirectiveAutoConfig: TradingDirectiveAutoConfig,
    lpSizeUsd: number,
  ) {
    return this.validateQuotation(p, tradingIntent, purpose, tradingDirectiveAutoConfig, lpSizeUsd);
  }

  async validateQuotationForSellExit(
    p: PairCreateInput,
    tradingIntent: TradingIntend,
    purpose: 'tp' | 'sl',
    tradingDirectiveAutoConfig: TradingDirectiveAutoConfig,
    lpSizeUsd: number,
  ) {
    return this.validateQuotation(p, tradingIntent, purpose, tradingDirectiveAutoConfig, lpSizeUsd);
  }

  async validateQuotation(
    p: PairCreateInput,
    tradingIntent: TradingIntend,
    purpose: 'entry' | 'tp' | 'sl',
    tradingDirectiveAutoConfig: TradingDirectiveAutoConfig,
    lpSizeUsd: number,
  ): Promise<ValidateQuotation> {
    const pData = p.data as DtPair;
    const { baseSortedIdx: bi, quoteSortedIdx: qi } = this.getSortedIdx(pData);
    if (bi === -1) {
      throw new AppError('{validateQuotation} SKIP because no token pair is common quote token', 'NoQuoteFound');
    }
    // const bi = 1, qi = 0; // FAKE: this code for debug only

    const baseTokenData = pData['token' + bi] as DTToken; // Can be token0 or token1
    const quoteTokenData = pData['token' + qi] as DTToken; // Can be token0 or token1
    const baseReserve = pData['reserve' + bi];
    const quoteReserve = pData['reserve' + qi];
    // const baseInitialReserve = pData.initialReserve0;
    // const quoteInitialReserve = pData.initialReserve1;
    this.logger.log('{validateQuotation} [bi, qi]: ' + `[${bi}, ${qi}]`);

    /**
     * We only trade on some currency WBNB, USDT, ...
     * Sometime we may enable USDT only.
     */
    const quoteSymbol = quoteTokenData.symbol;
    if (!this.activeQuoteSymbols.has(quoteSymbol)) {
      throw new AppError(`{validateQuotation} SKIP: ${quoteSymbol} is not activeQuoteSymbols`, 'NotActiveSymbol');
    }

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
    // we're going to buy Base, sell quote token, mean swap [quote => base]
    /**
     * @throws this can throw error
     */
    const isBuying = purpose === 'entry';
    const maxPossibleSellAmount = await this.maxPossibleSellTokenTradingVol(
      tradingDirectiveAutoConfig,
      isBuying ? quoteTokenData : baseTokenData,
      quoteTokenData,
      isBuying ? baseReserve : quoteReserve,
      isBuying ? quoteReserve : baseReserve,
      lpSizeUsd,
    );
    // maxPossibleSellAmount = 50; // FAKE: this is for debug only
    if (!(maxPossibleSellAmount > 0)) {
      throw new AppError('{validateQuotation} SKIP: Invalid sell amount: ' + maxPossibleSellAmount, 'CannotGetMaxVol');
    }

    // TODO: Approve max amount for all the common quotes token when program started,
    //    cache approved contract to db to avoid re-approve, save time
    // TODO: Approve the base token with max amount right here
    //    cache approved contract to db to avoid re-approve, save time
    // tokenAmountToSell in token, force min(5% LP, $500) to get quotes
    let tokenAmountToSell = 0;
    switch (purpose) {
      case 'tp':
      case 'sl':
        /**
         * We've bought this base token before, and then now we sell all of it
         */
        const owningBaseAmount = tradingIntent.vol.toNumber();
        tokenAmountToSell = Math.min(maxPossibleSellAmount, owningBaseAmount);
        break;
      case 'entry':
        /**
         * We need to sell quote token as max as possible to buy base token
         */
        tokenAmountToSell = maxPossibleSellAmount;
        break;
      default:
        throw new AppError('Cannot choose tokenAmountToSell for unhandled purpose: ' + purpose);
    }

    const maxPriceImpactPercent = tradingDirectiveAutoConfig.slippage_tolerant_percent?.toNumber() ?? 10;
    const denom = this.pancakeswapV2Service.SLIPPAGE_DENOMINATOR; // denominator is 10k in PcsV2 service
    const slippageTolerant = Math.floor((maxPriceImpactPercent / 100) * denom).toString();
    const quotes = await this.pancakeswapV2Service.getQuotation(
      isBuying ? base : quote,
      isBuying ? quote : base,
      tokenAmountToSell.toString(),
      slippageTolerant,
    );

    return {
      base,
      quote,
      quotes,
      maxPriceImpactPercent,
      tokenAmountToSell,
    };
  }

  async lockTrade(tradingIntent: TradingIntend, purpose: 'entry' | 'tp' | 'sl') {
    try {
      const nextStatus =
        purpose === 'entry'
          ? TradingIntendStatus.TakingEntry
          : purpose === 'tp' || purpose === 'sl'
          ? TradingIntendStatus.TakingExit
          : null;

      if (!nextStatus) {
        throw new Error('lockTrade: Invalid purpose');
      }
      await this.prisma.tradingIntend.update({
        where: { id: tradingIntent.id },
        data: { status: nextStatus },
      });
    } catch (e) {
      this.logger.error('lock: ', e);
    }
  }

  async unlockTrade(tradingIntent: TradingIntend, purpose: 'entry' | 'tp' | 'sl') {
    try {
      const nextStatus =
        purpose === 'entry'
          ? TradingIntendStatus.FindingEntry
          : purpose === 'tp' || purpose === 'sl'
          ? TradingIntendStatus.FindingExit
          : null;

      if (!nextStatus) {
        throw new Error('unlockTrade: Invalid purpose');
      }
      await this.prisma.tradingIntend.update({
        where: { id: tradingIntent.id },
        data: { status: nextStatus },
      });
    } catch (e) {
      this.logger.error('lock: ', e);
    }
  }

  async reverseTradeOnError(tradingIntent: TradingIntend, purpose: 'entry' | 'tp' | 'sl') {
    await this.unlockTrade(tradingIntent, purpose);

    // TODO: Notice someone via tele or UI
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

  private async validateTradingIntend(
    p: PairCreateInput,
    tradingIntent?: TradingIntend,
    expectedStatus = TradingIntendStatus.FindingEntry,
  ) {
    if (!tradingIntent) {
      try {
        tradingIntent = await this.prisma.tradingIntend.findFirst({
          where: {
            pair_id: p.id,
            status: expectedStatus,
          },
        });
      } catch (e) {
        // eslint-disable-next-line max-len
        this.logger.error(
          '{tryPlaceEntry} SKIP: Cannot find tradingIntent ' + expectedStatus + ' pair for: ' + p.id + ' with error:',
          e.code,
          e,
        );
        throw e;
      }
    }

    // null = not found
    if (!tradingIntent) {
      // eslint-disable-next-line max-len
      throw new AppError(
        '{tryPlaceEntry} SKIP: Cannot find tradingIntent ' + expectedStatus + ' pair for: ' + p.id,
        'TradingIntendStatus.NotFound',
      );
    }

    if (tradingIntent.status != expectedStatus) {
      // eslint-disable-next-line max-len
      throw new AppError(
        '{tryPlaceEntry} SKIP: tradingIntent.status != ' + expectedStatus + ': ' + p.id + ' ' + tradingIntent.status,
        'TradingIntendStatus.NotEqual',
      );
    }

    return tradingIntent;
  }

  // LP must be big enough
  private async validateLpSize(p: PairCreateInput, tradingDirectiveAutoConfig: TradingDirectiveAutoConfig) {
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

    if (lpSizeUsd < minLpSizeUsd) {
      // this.logger.warn("SKIP: LP is not big enough: " + `Actual:${lpSizeUsd}USD < Expect:${minLpSizeUsd}USD`);
      // return;
      throw new AppError(
        'SKIP: LP is not big enough: ' + `Actual:${lpSizeUsd}USD < Expect:${minLpSizeUsd}USD`,
        'LpTooSmall',
      );
    }

    return {
      lpSizeUsd,
      minLpSizeUsd,
    };
  }

  /**
   * @internet using BinanceTradingEndpoint
   */
  async maxPossibleSellTokenTradingVol(
    tradingDirectiveAutoConfig,
    sellTokenData: DTToken,
    quoteTokenData: DTToken,
    buyTokenReserve,
    sellTokenReserve,
    lpSizeUsd: number,
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
    const quotePriceUsd = await this.pairRealtimeDataService.getSymbolPriceUsd(
      quoteTokenData.symbol,
      this.pancakeswapV2Service.getChainId(),
      quoteTokenData.id,
    );
    if (quotePriceUsd === null) {
      throw new AppError('Cannot get quotePriceUsd from pairRealtimeDataService', 'CannotGetSymbolPrice');
    }
    // This is unsafe calculation
    // normally base value and quote value need to be the same
    // So quote_token_in_lp * quote_price ~= base_token_in_lp * base_price
    // const estimatedBuyPriceUsd = (sellTokenReserve * quotePriceUsd) / buyTokenReserve;
    // const maxBuyTokenVolumnInToken = maxVolInUsd / estimatedBuyPriceUsd; // NOTE: sell `quote` to buy `base`

    /*
    How to calculate:
    Buy ANM/BNB
      => trading vol == SELL amount of BNB
      => trading vol = maxVol / BNBPrice
                     = maxVol / QuotePrice

    Sell ANM/BNB
      => trading vol == SELL amount of ANM
      => trading vol = maxVol / ANMPrice = maxVol / (1 / BNBPrice)
                 = maxVol * QuotePrice
     */
    const sellingTokenIsQuote = sellTokenData.id === quoteTokenData.id; // Don't need toLowercase()
    const maxSellingTokenAmount = sellingTokenIsQuote ? maxVolInUsd / quotePriceUsd : maxVolInUsd * quotePriceUsd;

    return maxSellingTokenAmount;
  }

  async tryTp(p: PairCreateInput, tradingIntent?: TradingIntend) {
    if (!this.isActiveTradingPair(p.id)) {
      this.logger.debug('Not isActiveTradingPair: ' + p.id);
      return;
    }

    // Only place entry for: status = FindingExit
    try {
      tradingIntent = await this.validateTradingIntend(p, tradingIntent, TradingIntendStatus.FindingExit);
    } catch (e) {
      this.logger.error('{tryTp.validateTradingIntend} e.code: ' + e.code, e);
      return;
    }

    const purpose = 'tp';
    await this.lockTrade(tradingIntent, purpose);

    const tradingDirectiveAutoConfig = await this.prisma.tradingDirectiveAutoConfig.findFirst();
    if (tradingDirectiveAutoConfig === null) {
      this.logger.error(new AppError('SKIP: tradingDirectiveAutoConfig not exist', 'MissingDbConfig'));
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }

    // LP for selling don't need to be big enough, warning is enough
    let lpInfo: {
      lpSizeUsd: number;
      minLpSizeUsd: number;
    };
    try {
      lpInfo = await this.validateLpSize(p, tradingDirectiveAutoConfig);
    } catch (e) {
      this.logger.warn('{tryTp.validateLpSize} e.code: ' + e.code, e);
    }
    const { lpSizeUsd, minLpSizeUsd } = lpInfo;

    // validate entry price
    const entryPrice = tradingIntent.entry?.toNumber();
    if (!entryPrice) {
      this.logger.error('{tryTp} SKIP: tradingIntent.entry empty');
      await this.unlockTrade(tradingIntent, purpose);
      return;
    }

    // ---- get realtime quote -----
    let q: ValidateQuotation;
    try {
      q = await this.validateQuotationForSellExit(p, tradingIntent, purpose, tradingDirectiveAutoConfig, lpSizeUsd);
    } catch (e) {
      this.logger.warn(e); // This is how to log to file logger
      console.error(e); // This is only way to log this error to console
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }
    const { base, quote, quotes, maxPriceImpactPercent, tokenAmountToSell } = q;

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

    // Validate price impact
    const priceImpactPercent = Number(quotes.priceImpact.toSignificant());
    // eslint-disable-next-line max-len
    this.logger.verbose(
      '{tryPlaceEntry} priceImpactPercent, maxAllowed: ' + `${priceImpactPercent}% ${maxPriceImpactPercent}%`,
    );
    // price_impact <= 10%
    if (priceImpactPercent > maxPriceImpactPercent) {
      // eslint-disable-next-line max-len
      this.logger.warn(`SKIP: because of priceImpact=${priceImpactPercent}% larger than ${maxPriceImpactPercent}%`);
      await this.reverseTradeOnError(tradingIntent, purpose);
      return q;
    }

    // Validate target price
    // sell price: 1 out = ? in
    const executionPrice = Number(quotes.executionPrice.toSignificant());
    const tpTarget = tradingDirectiveAutoConfig.tp_target.toNumber();
    const tpTargetPrice = entryPrice * tpTarget;
    const shouldTp = executionPrice >= tpTargetPrice;
    this.logger.debug(
      '{tryTp} ' +
        JSON.stringify({
          currentPrice: executionPrice,
          targetPrice: tpTargetPrice,
          current: round(entryPrice / tpTargetPrice, 3),
          target: tpTarget,
        }),
    );
    if (!shouldTp) {
      this.logger.debug('{tryTp} SKIP: not reach tp_target');
      await this.unlockTrade(tradingIntent, purpose);
      return q;
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
        quote,
        base,
        opt,
      );
    } catch (e) {
      this.logger.error(`swapTokensWithTradeObject: e: `, e);
      console.error(e); // This is only way to log this error to console
      await this.reverseTradeOnError(tradingIntent, purpose);
      return q;
    }

    // Save to trade history
    try {
      const sellPrice = executionPrice;
      const buyPrice = 1 / executionPrice;
      // It's approximately amount, not strict equal
      // sellAmount * sellPrice
      const estimatedTokenReceived = tokenAmountToSell * sellPrice;
      const historyEntry = await this.prisma.tradeHistory.create({
        data: {
          sell: base.symbol,
          buy: quote.symbol,
          sell_amount: tokenAmountToSell,
          received_amount: Number(estimatedTokenReceived),
          base_price: sellPrice, // 1 base = ? quote
          price_impact_percent: Number(quotes.priceImpact.toSignificant()),
          status: TradeHistoryStatus.S,
          duration: swapResult.duration,
          receipt: swapResult,
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradeHistory.inserted: ');

      const ti = await this.prisma.tradingIntend.update({
        where: { id: tradingIntent.id },
        data: {
          // NOTE: When you sell all, note that this is not 100% correct number
          // It's estimated, luckily it's might always smaller number than actual? => plz check
          vol: Number(estimatedTokenReceived),
          tp: sellPrice,
          status: TradingIntendStatus.TP,
          profit_percent: round((100 * (sellPrice - entryPrice)) / entryPrice, 2),
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradingIntend.updated: ');

      // NOTE: This event can be transmitted to FE / admin dashboard
      this.eventEmitter.emit('trade.tp', {
        pair: p,
        historyEntry: historyEntry,
        tradingIntent: ti,
      });
    } catch (e) {
      this.logger.error('tradeHistory.create: e: ', e);
    }

    // Stop trade for this pair because of TP
    this.stopNewPairTradingFlow(p);

    return q;
  }

  /**
   * NOTE: quotation: trySL can use same ValidateQuotation with tryTP,
   * it's ok but be careful when doing sth base on $purpose var
   */
  async trySl(p: PairCreateInput, tradingIntent?: TradingIntend, quotation?: ValidateQuotation) {
    if (!this.isActiveTradingPair(p.id)) {
      this.logger.debug('Not isActiveTradingPair: ' + p.id);
      return;
    }

    // Only place entry for: status = FindingExit
    try {
      tradingIntent = await this.validateTradingIntend(p, tradingIntent, TradingIntendStatus.FindingExit);
    } catch (e) {
      this.logger.error('{trySl.validateTradingIntend} e.code: ' + e.code, e);
      return;
    }

    const purpose = 'sl';
    await this.lockTrade(tradingIntent, purpose);

    const tradingDirectiveAutoConfig = await this.prisma.tradingDirectiveAutoConfig.findFirst();
    if (tradingDirectiveAutoConfig === null) {
      this.logger.error(new AppError('{trySl} SKIP: tradingDirectiveAutoConfig not exist', 'MissingDbConfig'));
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }

    // LP for selling don't need to be big enough, warning is enough
    let lpInfo: {
      lpSizeUsd: number;
      minLpSizeUsd: number;
    };
    try {
      lpInfo = await this.validateLpSize(p, tradingDirectiveAutoConfig);
    } catch (e) {
      this.logger.warn('{trySl.validateLpSize} e.code: ' + e.code, e);
    }
    const { lpSizeUsd } = lpInfo;

    // validate entry price
    const entryPrice = tradingIntent.entry?.toNumber();
    if (!entryPrice) {
      this.logger.error('{trySl} SKIP: tradingIntent.entry empty');
      await this.unlockTrade(tradingIntent, purpose);
      return;
    }

    // ---- get realtime quote -----
    let q: ValidateQuotation;
    try {
      q =
        quotation ??
        (await this.validateQuotationForSellExit(p, tradingIntent, purpose, tradingDirectiveAutoConfig, lpSizeUsd));
    } catch (e) {
      this.logger.warn(e); // This is how to log to file logger
      console.error(e); // This is only way to log this error to console
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }
    const { base, quote, quotes, maxPriceImpactPercent, tokenAmountToSell } = q;

    this.logger.log('{trySl} quotes: ', {
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

    // Validate price impact
    const priceImpactPercent = Number(quotes.priceImpact.toSignificant());
    // eslint-disable-next-line max-len
    this.logger.verbose(
      '{trySl} priceImpactPercent, maxAllowed: ' + `${priceImpactPercent}% ${maxPriceImpactPercent}%`,
    );
    // We don't care price impact when taking SL

    // Validate target price
    // sell price: 1 out = ? in
    const executionPrice = Number(quotes.executionPrice.toSignificant());
    const slTarget = tradingDirectiveAutoConfig.sl_target.toNumber();
    const slTargetPrice = entryPrice * slTarget;
    const shouldSl = executionPrice < slTargetPrice;
    this.logger.debug(
      '{trySl} ' +
        JSON.stringify({
          currentPrice: executionPrice,
          targetPrice: slTargetPrice,
          current: round(entryPrice / slTargetPrice, 3),
          target: slTarget,
        }),
    );
    if (!shouldSl) {
      this.logger.debug('{tryTp} SKIP: not reach sl_target');
      await this.unlockTrade(tradingIntent, purpose);
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
        quote,
        base,
        opt,
      );
    } catch (e) {
      this.logger.error(`swapTokensWithTradeObject: e: `, e);
      console.error(e); // This is only way to log this error to console
      await this.reverseTradeOnError(tradingIntent, purpose);
      return;
    }

    // Save to trade history
    try {
      const sellPrice = executionPrice;
      // const buyPrice = 1 / executionPrice;
      // It's approximately amount, not strict equal
      // sellAmount * sellPrice
      const estimatedTokenReceived = tokenAmountToSell * sellPrice;
      const historyEntry = await this.prisma.tradeHistory.create({
        data: {
          sell: base.symbol,
          buy: quote.symbol,
          sell_amount: tokenAmountToSell,
          received_amount: Number(estimatedTokenReceived),
          base_price: sellPrice, // 1 base = ? quote
          price_impact_percent: Number(quotes.priceImpact.toSignificant()),
          status: TradeHistoryStatus.S,
          duration: swapResult.duration,
          receipt: swapResult,
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradeHistory.inserted: ');

      const ti = await this.prisma.tradingIntend.update({
        where: { id: tradingIntent.id },
        data: {
          // NOTE: When you sell all, note that this is not 100% correct number
          // It's estimated, luckily it's might always smaller number than actual? => plz check
          vol: Number(estimatedTokenReceived),
          tp: sellPrice,
          status: TradingIntendStatus.SL,
          profit_percent: round((100 * (sellPrice - entryPrice)) / entryPrice, 2),
        },
      });
      this.logger.verbose('{tryPlaceBuyEntry} tradingIntend.updated: ');

      // NOTE: This event can be transmitted to FE / admin dashboard
      this.eventEmitter.emit('trade.tp', {
        pair: p,
        historyEntry: historyEntry,
        tradingIntent: ti,
      });
    } catch (e) {
      this.logger.error('tradeHistory.create: e: ', e);
    }

    // Stop trade for this pair because of TP
    this.stopNewPairTradingFlow(p);
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

  async loadSupportedQuoteSymbols() {
    const cfg = await this.prisma.appConfig.findUnique({
      where: { key: 'activeQuoteSymbols' },
    });
    if (cfg) {
      const symbols: string[] = JSON.parse(cfg.value);
      this.activeQuoteSymbols = new Map<string, true>();
      for (let i = 0, c = symbols.length; i < c; i++) {
        const item = symbols[i];
        this.activeQuoteSymbols.set(item, true);
      }
    } else {
      throw new AppError('No activeQuoteSymbols found, plz set app_config.activeQuoteSymbols');
    }
  }

  async setSupportedQuoteSymbols(symbols: string[]) {
    this.activeQuoteSymbols = new Map<string, true>();
    for (let i = 0, c = symbols.length; i < c; i++) {
      const item = symbols[i];
      this.activeQuoteSymbols.set(item, true);
    }

    await this.prisma.appConfig.update({
      where: { key: 'activeQuoteSymbols' },
      data: { value: JSON.stringify(symbols) },
    });
  }
}
