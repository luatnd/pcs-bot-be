import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { AppError } from '../../libs/errors/base.error';

export type AppTradingMode = 'all' | 'contracts' | 'singlePair';

export class TradingMode {
  private readonly logger = new Logger(TradingMode.name);
  private prisma: PrismaService;

  private tradingMode: AppTradingMode = 'contracts';
  private singlePairModeData = {
    // enabled: true, // default is true, your must fire graphql mutation to start all pair
    pairOnChainId: null,
  };
  private contractsModeData = {
    enabled_contracts: new Map<string, true>(),
  };

  private static instance: TradingMode;
  private constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.loadData();
  }
  public static getInstance(prisma): TradingMode {
    if (!TradingMode.instance) {
      TradingMode.instance = new TradingMode(prisma);
    }

    return TradingMode.instance;
  }

  // Has async work inside sync fn
  private async loadData() {
    const redListContracts = await this.prisma.tradingDirectiveRedListContract.findMany();
    const contracts = redListContracts.map((i) => i.contract);
    for (let i = 0, c = contracts.length; i < c; i++) {
      this.contractsModeData.enabled_contracts.set(contracts[i], true);
    }
    this.logger.log(`Redlist loaded: `, contracts);
  }

  private setDefaultTradingMode() {
    this.setTradingMode('contracts');
  }

  getTradingMode() {
    return this.tradingMode;
  }

  private setupMode(mode: AppTradingMode, data?: any) {
    switch (mode) {
      case 'all':
        this.logger.warn('[Runtime] All pairs mode ENABLED\n');
        break;
      case 'contracts':
        if (data) {
          this.setRedListContract(data, true);
        }
        this.logger.warn(
          '[Runtime] Contract mode ENABLED for contracts: ' +
            Array.from(this.contractsModeData.enabled_contracts.keys()).join(',') +
            '\n',
        );
        break;
      case 'singlePair':
        this.singlePairModeData.pairOnChainId = data;
        this.logger.warn('[Runtime] Single pair mode ENABLED for pair_id: ' + data + '\n');
        break;
      default:
        throw new AppError('Invalid mode: ' + mode, 'InvalidMode');
    }
  }

  setTradingMode(mode: AppTradingMode, data?: any) {
    this.tradingMode = mode;
    this.setupMode(mode, data);
  }

  isSinglePairMode(): boolean {
    // return this.singlePairModeData.enabled;
    return this.tradingMode === 'singlePair';
  }

  getSinglePairModePairKey(): string {
    return this.singlePairModeData.pairOnChainId;
  }

  // NOTE: Remember to remove contract after TP/SL
  setRedListContract(contract: string, enabled: boolean) {
    if (enabled) {
      this.contractsModeData.enabled_contracts.set(contract, true);
      try {
        this.prisma.tradingDirectiveRedListContract
          .create({ data: { contract } })
          .then()
          .catch((e) => false);
      } catch (e) {}
    } else {
      this.contractsModeData.enabled_contracts.delete(contract);
      try {
        this.prisma.tradingDirectiveRedListContract
          .deleteMany({ where: { contract } })
          .then()
          .catch((e) => false);
      } catch (e) {}
    }
  }

  isRedListContractEnabled(contract: string) {
    return this.contractsModeData.enabled_contracts.has(contract);
  }
}
