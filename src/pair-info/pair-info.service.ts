import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DtPair } from './type/dextool';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';

@Injectable()
export class PairInfoService {
  private readonly logger = new Logger(PairInfoService.name);

  constructor(private prisma: PrismaService) {}

  getPairId(p: PairCreateInput) {
    return `${p.base}_${p.quote}_${p.chain_id}_${p.broker_id}`;
  }

  async createPool(dtPair: DtPair) {
    const pair: PairCreateInput = {
      id: '',
      base: '',
      quote: '',
      chain_id: 0, // TODO
      broker_id: '',
      data: dtPair,
    };
    pair.id = this.getPairId(pair);

    this.prisma.pair.create({ data: pair });
  }

  async updatePool() {
    //
  }

  async updateTradingInfo() {
    //
  }
}
