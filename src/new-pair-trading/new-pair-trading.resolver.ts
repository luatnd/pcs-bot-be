import { Query, Resolver } from '@nestjs/graphql';
import { NewPairTradingService } from './new-pair-trading.service';

@Resolver()
export class NewPairTradingResolver {
  constructor(private newPairTradingService: NewPairTradingService) {}

  @Query(() => Boolean)
  async tradingDebug(): Promise<any> {
    const pair = await this.newPairTradingService.getPairById('ANM_BUSD_56_pancakev2');
    await this.newPairTradingService.handleLpCreatedEvent(pair);
  }
}
