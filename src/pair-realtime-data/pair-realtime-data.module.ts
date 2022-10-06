import { Module } from '@nestjs/common';
import { PairRealtimeDataService } from './pair-realtime-data.service';

@Module({
  providers: [PairRealtimeDataService],
  exports: [PairRealtimeDataService],
})
export class PairRealtimeDataModule {}
