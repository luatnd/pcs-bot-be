import { Module } from '@nestjs/common';
import { PairInfoResolver } from './pair-info.resolver';

@Module({
  providers: [PairInfoResolver],
})
export class PairInfoModule {}
