import { Injectable, Logger } from '@nestjs/common';
import { ContractAddress } from '../pair-info/type/dextool';

@Injectable()
export class PancakeswapV2Service {
  private readonly logger = new Logger(PancakeswapV2Service.name);

  getQuotes(baseAddress: ContractAddress, quoteAddress: ContractAddress, baseAmountInToken: number) {
    //
  }

  swap() {
    //
  }
}
