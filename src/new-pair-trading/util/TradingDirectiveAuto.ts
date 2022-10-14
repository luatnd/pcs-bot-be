import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../../libs/errors/base.error';
// eslint-disable-next-line max-len
import { TradingDirectiveAutoConfig } from '../../prisma/@generated/graphql/trading-directive-auto-config/trading-directive-auto-config.model';

export class TradingDirectiveAuto {
  // Simple cache using hash map
  public config: TradingDirectiveAutoConfig = null;
  private prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.loadDataNonblocking();
    this.scheduleRefresh();
  }

  // Has async work inside sync fn
  async loadDataNonblocking(allowThrow = true) {
    const tradingDirectiveAutoConfig = await this.prisma.tradingDirectiveAutoConfig.findFirst();
    if (tradingDirectiveAutoConfig === null) {
      if (allowThrow) {
        throw new AppError('SKIP: tradingDirectiveAutoConfig not exist', 'MissingDbConfig');
      }
    }

    this.config = tradingDirectiveAutoConfig;
  }

  async scheduleRefresh() {
    setInterval(() => {
      this.loadDataNonblocking(false);
    }, 60 * 1000); // refresh cache every 2 min
  }
}
