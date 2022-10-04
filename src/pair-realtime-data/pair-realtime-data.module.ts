import { Module } from '@nestjs/common';
import { PairRealtimeDataService } from './pair-realtime-data.service';

@Module({
  providers: [PairRealtimeDataService],
})
export class PairRealtimeDataModule {}
