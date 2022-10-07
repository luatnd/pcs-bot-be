import { Query, Resolver } from '@nestjs/graphql';
import { NewPairTradingService } from './new-pair-trading.service';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';
import { WBNB_HERO_pair } from '../../dextool';

@Resolver()
export class NewPairTradingResolver {
  constructor(private newPairTradingService: NewPairTradingService) {}

  @Query(() => Boolean)
  async tradingDebug(): Promise<any> {
    // const pair = await this.newPairTradingService.getPairById('ANM_BUSD_56_pancakev2');
    const pair: PairCreateInput = {
      id: 'WBNB_HERO_56_pancakev2',
      on_chain_id: '0xe267018c943e77992e7e515724b07b9ce7938124',
      base: 'WBNB',
      quote: 'HERO',
      chain_id: 56,
      exchange_id: 'pancakev2',
      data: WBNB_HERO_pair,
      created_at: '2022-10-03 11:35:49.253',
      updated_at: '2022-10-03 16:33:19.244',
    };
    await this.newPairTradingService.handleLpCreatedEvent(pair);
  }
}
