import { Module } from '@nestjs/common';
import { NewPairTradingService } from './new-pair-trading.service';
import { PancakeswapV2Module } from '../pancakeswap-v2/pancakeswap-v2.module';

@Module({
  providers: [NewPairTradingService],
  imports: [PancakeswapV2Module],
})
export class NewPairTradingModule {}
