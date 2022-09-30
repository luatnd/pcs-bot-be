import { Module } from '@nestjs/common';
import { PairInfoResolver } from './pair-info.resolver';
import { PairInfoService } from './pair-info.service';
import { PairInfoServiceAuto } from './pair-info.service.auto';

@Module({
  providers: [PairInfoResolver, PairInfoService, PairInfoServiceAuto],
})
export class PairInfoModule {}
