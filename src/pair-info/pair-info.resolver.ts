import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { PairInfoServiceAuto } from './pair-info.service.auto';

@Resolver()
export class PairInfoResolver {
  constructor(private pairInfoServiceAuto: PairInfoServiceAuto) {}

  @Mutation(() => Boolean)
  async setSinglePairMode(
    @Args('pairOnChainId', {
      description: 'The pair id on-chain. Eg: The pair WBNB/HERO id=0xe267018c943e77992e7e515724b07b9ce7938124',
    })
    pairOnChainId: string,
  ): Promise<boolean> {
    this.pairInfoServiceAuto.setSinglePairModeFor(pairOnChainId);
    return true;
  }

  @Mutation(() => Boolean)
  async disableSinglePairMode(): Promise<boolean> {
    this.pairInfoServiceAuto.setSinglePairModeFor(null);
    return true;
  }
}
