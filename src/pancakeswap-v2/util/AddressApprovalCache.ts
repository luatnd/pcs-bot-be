import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../../libs/errors/base.error';
// eslint-disable-next-line max-len
import { ApprovedContract } from '../../prisma/@generated/graphql/approved-contract/approved-contract.model';

export class AddressApprovalCache {
  // Simple cache using hash map
  public approvedAddresses: Map<string, true> = new Map();
  private prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  // Has async work inside sync fn
  async loadData(wallet: string) {
    if (!wallet) {
      throw new AppError('Cannot load wallet address, might need some delay', 'InvalidWalletAddress');
    }

    const approvals = await this.prisma.approvedContract.findMany({
      where: { wallet },
    });
    for (let i = 0, c = approvals.length; i < c; i++) {
      const item: ApprovedContract = approvals[i];
      this.approvedAddresses.set(this.getMapKey(item.wallet, item.contract), true);
    }
  }

  isApproved(wallet: string, contract: string): boolean {
    return this.approvedAddresses.has(this.getMapKey(wallet, contract));
  }

  // Has async work inside sync fn
  set(wallet: string, contract: string, approved: boolean) {
    const k = this.getMapKey(wallet, contract);
    if (approved) {
      this.approvedAddresses.set(k, true);
      try {
        this.prisma.approvedContract
          .create({
            data: { wallet, contract },
          })
          .then()
          .catch((e) => false);
      } catch (e) {}
    } else {
      this.approvedAddresses.delete(k);
      try {
        this.prisma.approvedContract
          .delete({
            where: {
              wallet_contract: { wallet, contract },
            },
          })
          .then()
          .catch((e) => false);
      } catch (e) {}
    }
  }

  getMapKey(wallet: string, contract: string): string {
    return `${wallet}_${contract}`;
  }
}
