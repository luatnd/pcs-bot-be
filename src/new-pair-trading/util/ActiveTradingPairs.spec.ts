/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { NewPairTradingService } from '../new-pair-trading.service';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PancakeswapV2Module } from '../../pancakeswap-v2/pancakeswap-v2.module';
import { CacheModule } from '@nestjs/common';
import { PairCreateInput } from '../../prisma/@generated/graphql/pair/pair-create.input';
import { PrismaModule } from '../../prisma/prisma.module';
import { getAppLogger } from '../../utils/logger';
import { WBNB_HERO_pair } from '../../../dextool';
import { PairRealtimeDataModule } from '../../pair-realtime-data/pair-realtime-data.module';
import { sleep } from '../../utils/time';

async function turnOnAppLogger(module: TestingModule) {
  let app = module.createNestApplication();
  const logger = getAppLogger();
  await app.init();
  app.useLogger(logger);
}

describe('ActiveTradingPairs', () => {
  let service: NewPairTradingService;

  beforeEach(async () => {
    // console.log('{ActiveTradingPairs.beforeEach} : ', );

    const module: TestingModule = await Test.createTestingModule({
      providers: [NewPairTradingService],
      imports: [
        // Copy some needed info from app module
        ConfigModule.forRoot({ isGlobal: true }),
        CacheModule.register({ isGlobal: true }),
        EventEmitterModule.forRoot({
          verboseMemoryLeak: true,
        }),
        PrismaModule,
        PancakeswapV2Module,
        PairRealtimeDataModule,
      ],
    }).compile();

    await turnOnAppLogger(module);

    service = module.get<NewPairTradingService>(NewPairTradingService);
  });

  // yarn test --verbose
  // --testNamePattern=^PancakeswapV2Service.Just for debug$
  // --runTestsByPath src/pancakeswap-v2/pancakeswap-v2.service.spec.ts
  it('Can persist into db', async () => await persistCache(service));
  it('Can load from db', async () => await loadCache(service));
  it('Can remove from db', async () => await rmCache(service));
});

async function persistCache(service) {
  service.setActiveTradingPair('UNIT_TEST_1', true);
  service.setActiveTradingPair('UNIT_TEST_' + Date.now(), true);

  await sleep(200); // wait for db writing
  // can persist twice without duplication
  service.setActiveTradingPair('UNIT_TEST_1', true);

  await sleep(200); // wait for db writing
  const inDb = await service.activeTradingPairs.hasPersisted('UNIT_TEST_1');
  expect(inDb).toBeTruthy();
}

async function loadCache(service) {
  // NOTE: This test must be run after persistCache
  await sleep(200); // wait for loading cache
  expect(service.isActiveTradingPair('UNIT_TEST_1')).toBeTruthy();
}

async function rmCache(service) {
  await sleep(200); // wait for loading cache

  const pairId = 'UNIT_TEST_1';
  service.setActiveTradingPair(pairId, false);
  expect(service.isActiveTradingPair(pairId)).toBeFalsy();

  await sleep(200); // wait for loading cache
  const inDb = await service.activeTradingPairs.hasPersisted(pairId);
  expect(inDb).toBeFalsy();
}
