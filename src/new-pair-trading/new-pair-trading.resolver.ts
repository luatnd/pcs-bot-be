import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NewPairTradingService } from './new-pair-trading.service';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';
import { ANM_WBNB_97_pair, MYBUSD_ANM_97_pair, WBNB_HERO_pair } from '../../dextool';
import { PancakeswapV2Service } from '../pancakeswap-v2/pancakeswap-v2.service';
import { CommonBscQuoteSymbol, CommonBscSymbol } from '../pair-realtime-data/const/CommonBSCSymbol';

@Resolver()
export class NewPairTradingResolver {
  constructor(
    private newPairTradingService: NewPairTradingService,
    private pancakeswapV2Service: PancakeswapV2Service,
  ) {}

  @Mutation(() => Boolean)
  async forceLpCreatedEvent(@Args('pair') pair: PairCreateInput): Promise<boolean> {
    await this.newPairTradingService.handleLpCreatedEvent(pair);
    return true;
  }

  @Query(() => Boolean)
  async handleLpCreatedEventDebug(): Promise<any> {
    // const pair = await this.newPairTradingService.getPairById('ANM_BUSD_56_pancakev2');
    const pair: PairCreateInput = {
      id: 'ANM_BNB_97_pancakev2',
      on_chain_id: '0xe267018c943e77992e7e515724b07b9ce7938124',
      base: 'ANM',
      quote: 'BNB',
      chain_id: this.pancakeswapV2Service.getChainId(),
      exchange_id: 'pancakev2',
      data: ANM_WBNB_97_pair,
      created_at: '2022-10-03 11:35:49.253',
      updated_at: '2022-10-03 16:33:19.244',
    };
    // const pair: PairCreateInput = {
    //   id: 'MYBUSD_ANM_97_pancakev2',
    //   on_chain_id: 'FAKE',
    //   base: 'ANM',
    //   quote: 'MYBUSD',
    //   chain_id: this.pancakeswapV2Service.getChainId(),
    //   exchange_id: 'pancakev2',
    //   data: MYBUSD_ANM_97_pair,
    //   created_at: '2022-10-03 11:35:49.253',
    //   updated_at: '2022-10-03 16:33:19.244',
    // };
    await this.newPairTradingService.handleLpCreatedEvent(pair);

    return true;
  }

  @Query(() => Boolean)
  async swapUnsafeDebug(): Promise<any> {
    const ANM = ANM_WBNB_97_pair.token0;
    const WBNB = CommonBscQuoteSymbol.WBNB;
    const anmToken = this.pancakeswapV2Service.getAppToken(ANM.id, ANM.decimals, ANM.symbol, ANM.name);
    const wBNBToken = this.pancakeswapV2Service.getAppToken(WBNB.address, WBNB.decimal, WBNB.symbol, 'WBNB');
    await this.pancakeswapV2Service.swapUnsafe(anmToken, wBNBToken, '0.01', '1000'); // 10% slippage

    return true;
  }
}
