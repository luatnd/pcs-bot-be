import { Module } from '@nestjs/common';
import { PancakeswapV2Service } from './pancakeswap-v2.service';

@Module({
  providers: [PancakeswapV2Service],
})
export class PancakeswapV2Module {}
