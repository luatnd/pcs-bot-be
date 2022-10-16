import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { PairInfoServiceAuto } from './pair-info.service.auto';

@Resolver()
export class PairInfoResolver {
  constructor(private pairInfoServiceAuto: PairInfoServiceAuto) {}

  @Mutation(() => Boolean, {
    description: `Listen and trade for single pair only, use setSinglePair mutation to enable trade for single pair`,
  })
  async setTradeModeSinglePair(
    @Args('pairOnChainId', {
      description: 'The pair id on-chain. Eg: The pair WBNB/HERO id=0xe267018c943e77992e7e515724b07b9ce7938124',
    })
    pairOnChainId: string,
  ): Promise<boolean> {
    this.pairInfoServiceAuto.setTradingSubscriptionMode('singlePair', pairOnChainId);
    return true;
  }

  @Mutation(() => Boolean, { description: `Trading Mode: Listen and trade for all new pairs` })
  async setTradeModeAllContracts(): Promise<boolean> {
    this.pairInfoServiceAuto.setTradingSubscriptionMode('all');
    return true;
  }

  @Mutation(() => Boolean, {
    description: `This is default Trading Mode: 
    Listen and trade for only some pairs that contains configured contract address (RedList).
    You can call this multiple time for adding multiple contracts`,
  })
  async setTradeModeSomeContracts(@Args('contract', { description: 'Eg: 0x00' }) contract: string): Promise<boolean> {
    this.pairInfoServiceAuto.setTradingSubscriptionMode('contracts', contract);
    return true;
  }
}
