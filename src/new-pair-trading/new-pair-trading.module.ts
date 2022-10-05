import { Module } from '@nestjs/common';
import { NewPairTradingService } from './new-pair-trading.service';
import { PancakeswapV2Module } from '../pancakeswap-v2/pancakeswap-v2.module';
import { NewPairTradingResolver } from './new-pair-trading.resolver';

@Module({
  providers: [NewPairTradingService, NewPairTradingResolver],
  imports: [PancakeswapV2Module],
})
export class NewPairTradingModule {}
