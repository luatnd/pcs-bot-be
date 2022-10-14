import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import * as LRUCache from 'lru-cache';
import { ChainId } from '@pancakeswap/sdk';
import { CommonBscSymbol } from './const/CommonBSCSymbol';
import BinanceTradingEndpoint from '../../libs/binance/BinanceTradingEndpoint';
import { retryUntil } from '../utils/time';
import { AppError } from '../../libs/errors/base.error';

@Injectable()
export class PairRealtimeDataService {
  private readonly logger = new Logger(PairRealtimeDataService.name);
  private binanceTradingEndpoint: BinanceTradingEndpoint;

  // NOTE: This is for single chain: BSC only
  // Cache 10 most common symbol price
  private symbolPriceUsdCache = new LRUCache<string, number>({
    max: 100,
    ttl: 60 * 1000, // 1m
  });

  constructor(private eventEmitter: EventEmitter2) {
    this.binanceTradingEndpoint = BinanceTradingEndpoint.getInstance();
  }

  @OnEvent('nativeCurrency.price', { async: true })
  async handleNativeCurrencyPriceEvent(priceUsd: number) {
    this.symbolPriceUsdCache.set(this.getCacheKey(CommonBscSymbol.WBNB.symbol, ChainId.MAINNET), priceUsd);
    this.symbolPriceUsdCache.set(this.getCacheKey(CommonBscSymbol.BNB.symbol, ChainId.MAINNET), priceUsd);
  }

  getCacheEntries() {
    return this.symbolPriceUsdCache.dump();
  }

  private getCacheKey(symbol: string, chainId: number, address?: string): string {
    return `${chainId}_${symbol}_${address}`;
  }

  // Support BSC only
  async getSymbolPriceUsd(symbol: string, chainId: number, address?: string): Promise<number | null> {
    symbol = symbol.toUpperCase();

    if (this.isKnownStableCoin(symbol, address)) {
      return 1;
    }

    // Get from cache first
    const k = this.getCacheKey(symbol, chainId, address);
    if (this.symbolPriceUsdCache.has(k) && this.symbolPriceUsdCache.getRemainingTTL(k) > 0) {
      return this.symbolPriceUsdCache.get(k);
    }

    // If not in cache yet, fetch the price from API
    try {
      const priceUsd = await this.fetchSymbolPriceFromInternet(symbol);
      if (priceUsd === undefined) {
        return null;
      }

      this.symbolPriceUsdCache.set(k, priceUsd);
      return priceUsd;
    } catch (e) {
      return null;
    }
  }

  setSymbolPriceUsd(priceUsd: number, symbol: string, chainId: number, address?: string) {
    const k = this.getCacheKey(symbol, chainId, address);
    this.symbolPriceUsdCache.set(k, priceUsd);
  }

  // For BSC only
  private isKnownStableCoin(symbol: string, address: string): boolean {
    const knownSymbol = CommonBscSymbol[symbol];
    if (!knownSymbol) {
      return false;
    }

    return knownSymbol.address === address && knownSymbol.isStableCoin === true;
  }

  private async fetchSymbolPriceFromInternet(symbol: string): Promise<number | undefined> {
    const knownSymbol = CommonBscSymbol[symbol];
    if (!knownSymbol) {
      throw new AppError(
        'Symbol ' + symbol + ' must be exist in CommonBscSymbol, plz configure it',
        'CommonBscSymbolNotExist',
      );
    }
    const binanceSymbol = knownSymbol.symbolBinance;

    // Wait for Binance endpoint ready
    await retryUntil(() => this.binanceTradingEndpoint.ready, 10);

    try {
      const price = await this.binanceTradingEndpoint.getPrice(binanceSymbol);
      return Number(price);
    } catch (e) {
      this.logger.error('{fetchSymbolPriceFromInternet} e.code, e: ', e.code, e);
      return undefined;
    }
  }
}
