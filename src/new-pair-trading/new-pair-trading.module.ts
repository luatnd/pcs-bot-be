import { Module } from '@nestjs/common';
import { NewPairTradingService } from './new-pair-trading.service';
import { PancakeswapV2Module } from '../pancakeswap-v2/pancakeswap-v2.module';
import { NewPairTradingResolver } from './new-pair-trading.resolver';
import { PairRealtimeDataModule } from '../pair-realtime-data/pair-realtime-data.module';

@Module({
  providers: [NewPairTradingService, NewPairTradingResolver],
  imports: [PancakeswapV2Module, PairRealtimeDataModule],
})
export class NewPairTradingModule {}
