/* eslint-disable no-unused-vars */
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
  // const base = service.getAppToken('0x7470FF44A57FCe4b7413F31Fdc9b625ff58dBb9c', 18, 'ANM');
  const base = service.getAppToken('0x24802247bd157d771b7effa205237d8e9269ba8a', 18, 'THC', 'Thetan Coin');
  // const quote = service.getAppToken('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 18, 'BUSD');
  const quote = service.getAppToken('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', 18, 'WBNB');
  const amount = '100000';
  const slippageTolerance = '50';
  let r = null;

  // await service.swapUnsafe(base, quote, amount, slippageTolerance);
  r = await service.getQuotation(base, quote, amount, slippageTolerance);

  console.log('{debug} r: ', r);
}
