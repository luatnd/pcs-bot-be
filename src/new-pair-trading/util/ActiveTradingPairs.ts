import { PrismaService } from '../../prisma/prisma.service';

type PairId = string;

/**
 * Primary data source of activeTradingPairs data is in-memory
 * Database is secondary data source for persisting the cache data.
 * Program will load this data from db into memory on init
 * And persist to db table on changed
 */
export class ActiveTradingPairs {
  // Simple cache using hash map
  private activeTradingPairs: Map<PairId, true> = new Map<PairId, true>();
  private prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.loadData();
  }

  // Has async work inside sync fn
  async loadData() {
    const pairs = await this.prisma.activeTradingPair.findMany();
    for (let i = 0, c = pairs.length; i < c; i++) {
      const item = pairs[i];
      this.activeTradingPairs.set(item.pair_id, true);
    }
  }

  has(pairId: string): boolean {
    return this.activeTradingPairs.has(pairId);
  }

  // Has async work inside sync fn
  set(pairId: string, active: boolean) {
    if (active) {
      this.activeTradingPairs.set(pairId, true);
      try {
        this.prisma.activeTradingPair.create({ data: { pair_id: pairId } }).then();
      } catch (e) {}
    } else {
      this.activeTradingPairs.delete(pairId);
      try {
        this.prisma.activeTradingPair.delete({ where: { pair_id: pairId } }).then();
      } catch (e) {}
    }
  }

  async hasPersisted(pairId: string): Promise<boolean> {
    const p = await this.prisma.activeTradingPair.findUnique({ where: { pair_id: pairId } });
    return !!p;
  }
}
