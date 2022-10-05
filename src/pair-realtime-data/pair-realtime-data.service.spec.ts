/* eslint-disable no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { PairRealtimeDataService } from './pair-realtime-data.service';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/common';
import { CommonBscSymbol } from './const/CommonBSCSymbol';

describe('PairRealtimeDataService', () => {
  let service: PairRealtimeDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PairRealtimeDataService],
      imports: [
        // Copy some needed info from app module
        ConfigModule.forRoot({ isGlobal: true }),
        CacheModule.register({ isGlobal: true }),
        EventEmitterModule.forRoot({
          verboseMemoryLeak: true,
        }),
      ],
    }).compile();

    service = module.get<PairRealtimeDataService>(PairRealtimeDataService);
  });

  // yarn test --verbose --testNamePattern=^PancakeswapV2Service.Just for debug$
  // --runTestsByPath src/pancakeswap-v2/pancakeswap-v2.service.spec.ts
  it('Just for debug', () => debug(service));

  it('canGetAllCommonSymbolPrices', () => canGetAllCommonSymbolPrices(service));
});

async function debug(service) {
  const r = await service.getSymbolPriceUsd('WBNB', 56);
  console.log('{debug} r: ', r);
}

async function canGetAllCommonSymbolPrices(service) {
  const symbols = Object.values(CommonBscSymbol);
  for (let i = 0, c = symbols.length; i < c; i++) {
    const symbol = symbols[i];
    console.log('{canGetAllCommonSymbolPrices} symbol: ', symbol.symbol);

    // Skip some non trading pair / stable coin
    if (!symbol.symbolBinance) {
      continue;
    }

    const r = await service.getSymbolPriceUsd(symbol.symbol, 56);
    console.log('{canGetAllCommonSymbolPrices} price: ', r);

    expect(r).toBeDefined();
    expect(r).toBeGreaterThanOrEqual(0);
  }
}
