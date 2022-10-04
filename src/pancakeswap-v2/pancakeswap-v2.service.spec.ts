import { Test, TestingModule } from '@nestjs/testing';
import { PancakeswapV2Service } from './pancakeswap-v2.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

import * as dotenv from 'dotenv';
// Load .env into env so ConfigModule can work
dotenv.config();

describe('PancakeswapV2Service', () => {
  let service: PancakeswapV2Service;

  beforeEach(async () => {
    // const configServiceFake = {
    //   provide: ConfigService,
    //   useValue: {
    //     get: jest.fn((key: string) => {
    //       console.log('{configServiceFake.get} key: ', key);
    //       return process.env[key];
    //     }),
    //   },
    // };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PancakeswapV2Service,
        // configServiceFake,
      ],
      imports: [ConfigModule],
    }).compile();

    service = module.get<PancakeswapV2Service>(PancakeswapV2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // yarn test --verbose --testNamePattern=^PancakeswapV2Service.Just for debug$
  // --runTestsByPath src/pancakeswap-v2/pancakeswap-v2.service.spec.ts
  it('Just for debug', () => debug(service));
});

async function debug(service) {
  const base = service.getAppToken('0x7470FF44A57FCe4b7413F31Fdc9b625ff58dBb9c', 18, 'ANM');
  const quote = service.getAppToken('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 18, 'BUSD');
  const amount = '100000';
  const slippageTolerance = '50';
  await service.swapExactETHForToken(base, quote, amount, slippageTolerance);
}
