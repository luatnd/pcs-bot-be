import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { DtPair } from './type/dextool';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';
import { ChainId } from '../blockchain/_utils/const';
import { PrismaErrorCode } from '../prisma/const';
import { MAX } from 'class-validator';
import { round } from '../utils/number';

@Injectable()
export class PairInfoService {
  private readonly logger = new Logger(PairInfoService.name);

  // eslint-disable-next-line no-unused-vars
  constructor(private prisma: PrismaService, private eventEmitter: EventEmitter2) {}

  getPairId(p: PairCreateInput) {
    return `${p.base}_${p.quote}_${p.chain_id}_${p.exchange_id}`;
  }

  async createPool(dtPair: DtPair) {
    // console.log('{createPool} dtPair: ', dtPair);
    const pair = this.toAppPair(dtPair);
    const MAX_MINUTES_ALLOWED = 10;

    // NOTE: We should ignore if pool is created long time ago
    try {
      const pairAgeInMinutes = (Date.now() - new Date(dtPair.createdAt).getTime()) / (60 * 1000);
      const allow = 0 < pairAgeInMinutes && pairAgeInMinutes < MAX_MINUTES_ALLOWED;
      if (!allow) {
        // eslint-disable-next-line max-len
        this.logger.debug(
          `{createPool} SKIP: created ${round(pairAgeInMinutes, 2)}min ago > ${MAX_MINUTES_ALLOWED}min allowed`,
        );
        return;
      }
    } catch (e) {
      this.logger.warn('{createPool} Cannot validate LP age');
      return;
    }

    try {
      const r = await this.prisma.pair.create({ data: pair });
      this.logger.verbose('{createPool} storedRecord: ' + r.id);
      await this.onPoolCreated(pair);
    } catch (e) {
      if (e.code === PrismaErrorCode.NotUnique) {
        this.logger.warn('Duplicate create pool: dtPair.creation: ', this.getPairName(dtPair), dtPair.creation);
        return; // skip
      }

      this.logger.error('{updatePool} e.code, e: ', e.code, e);
    }
  }

  async updateOrCreatePool(dtPair: DtPair, createIfNotExist = true) {
    const pair = this.toAppPair(dtPair);
    this.logger.log('{updateOrCreatePool} : ' + this.getPairIdFromDtPair(dtPair));

    try {
      const storedRecord = await this.prisma.pair.update({
        where: { id: pair.id },
        data: pair,
      });
      this.logger.verbose('{updatePool} storedRecord: ' + storedRecord.id);
      await this.onPoolUpdated(pair);
    } catch (e) {
      if (e.code === PrismaErrorCode.RecordNotFound) {
        if (createIfNotExist) {
          // has creation info
          // if (dtPair.creation) {
          //   return this.createPool(dtPair);
          // } else {
          //   this.logger.warn('{updateOrCreatePool} SKIP: no pair.creation found: ' + pair.id);
          // }
          return this.createPool(dtPair);
        } else {
          this.logger.verbose('{updateOrCreatePool} SKIP: Not allow to create ' + pair.id);
        }
        return;
      }

      this.logger.error('{updatePool} e.code, e: ', e.code, e);
    }
  }

  async updateTradingInfo() {
    //
  }

  // @Event: new BNB price
  onNativeCurrencyPriceUpdated(priceUsd: number) {
    this.eventEmitter.emit('nativeCurrency.price', priceUsd);
  }

  // @Event: Pool created to db
  async onPoolCreated(pair: PairCreateInput) {
    // this.logger.log('OK {onPoolCreated} : ' + pair.id);
    this.eventEmitter.emit('lp.created', pair);
  }

  // @Event: Pool updated to db
  async onPoolUpdated(pair: PairCreateInput) {
    // this.logger.log('OK {onPoolUpdated} : ' + pair.id);
    this.eventEmitter.emit('lp.updated', pair);
  }

  private toAppPair(dtPair: DtPair): PairCreateInput {
    const pair: PairCreateInput = {
      id: '',
      on_chain_id: dtPair.id,
      base: dtPair.token0.symbol.trim(),
      quote: dtPair.token1.symbol.trim(),
      chain_id: this.getChainId(dtPair),
      exchange_id: dtPair.exchange,
      data: dtPair,
    };
    pair.id = this.getPairId(pair);

    return pair;
  }

  getPairIdFromDtPair(dtPair: DtPair) {
    const p = this.toAppPair(dtPair);
    return `${p.base}_${p.quote}_${p.chain_id}_${p.exchange_id}`;
  }

  getPairName(p: DtPair): string {
    return `${p.token0.symbol}/${p.token1.symbol}`;
  }

  getChainId(p: DtPair): ChainId | undefined {
    if (p.exchange === 'pancakev2') {
      return ChainId.BSC;
    }

    // TODO

    return undefined;
  }
}
