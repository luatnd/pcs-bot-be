/* eslint-disable */

// Load .env into env so ConfigModule can work
// import * as dotenv from 'dotenv';
// dotenv.config();

import { Test, TestingModule } from '@nestjs/testing';
import { NewPairTradingService } from './new-pair-trading.service';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PancakeswapV2Module } from '../pancakeswap-v2/pancakeswap-v2.module';
import { CacheModule } from '@nestjs/common';
import { PairCreateInput } from '../prisma/@generated/graphql/pair/pair-create.input';
import { PrismaModule } from '../prisma/prisma.module';
import { getAppLogger } from '../utils/logger';
import { WBNB_HERO_pair } from '../../dextool';
import { PairRealtimeDataModule } from '../pair-realtime-data/pair-realtime-data.module';

async function turnOnAppLogger(module: TestingModule) {
  let app = module.createNestApplication();
  const logger = getAppLogger();
  await app.init();
  app.useLogger(logger);
}

describe('NewPairTradingService', () => {
  let service: NewPairTradingService;

  beforeEach(async () => {
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

  it('Should be defined', () => {
    expect(service).toBeDefined();
  });

  // yarn test --verbose --testNamePattern=^PancakeswapV2Service.Just for debug$
  // --runTestsByPath src/pancakeswap-v2/pancakeswap-v2.service.spec.ts
  it('Just for debug', () => debug(service));
});

async function debug(service) {
  const pair: PairCreateInput = {
    id: 'WBNB_HERO_56_pancakev2',
    on_chain_id: '0xe267018c943e77992e7e515724b07b9ce7938124',
    base: 'WBNB',
    quote: 'HERO',
    chain_id: 56,
    exchange_id: 'pancakev2',
    // "data": {
    //   "id": "fake_", "__v": 1, "_id": "633a8a72104e078179d51941",
    //   "info": {"name": "Animverse", "locks": [], "symbol": "ANM", "address": "0x7470FF44A57FCe4b7413F31Fdc9b625ff58dBb9c", "holders": 60, "decimals": 18, "totalSupply": "1200000000000000000000000000", "maxSupplyFormatted": 1200000000, "totalSupplyFormatted": 1200000000, "totalSupplyFormattedUpdatedAt": "2022-10-03T07:35:10.346Z"},
    //   "team": {"wallet": "0xbaa68bf2cc7f57d810f328ef43256c7c1b071643"},
    //   "type": "stable-based-pair",
    //   "token0": {"symbol": "WBNB", "decimals": 18, "name": "WBNB token", "totalSupply": "1200000000000000000000000000", "id": "0x7470FF44A57FCe4b7413F31Fdc9b625ff58dBb9c", "_id": "633a8a73104e078179d51948", "audit": {"_id": "633b0ecf104e078179d6cebe", "date": "2022-10-03T07:08:55.242Z", "mint": false, "proxy": false, "status": "OK", "version": 1, "codeVerified": true, "unlimitedFees": false, "lockTransactions": false}},
    //   "token1": {"symbol": "HERO", "decimals": 18, "name": "HERO token", "totalSupply": "4850999126369409465655005310", "id": "0xe9e7cea3dedca5984780bafc599bd69add087d56", "_id": "61ddc3a091051aa34b80874c", "audit": {"_id": "633a8a73104e078179d5194a", "date": "2022-10-03T14:51:55.142Z", "mint": true, "proxy": false, "status": "OK", "version": 1, "codeVerified": true, "unlimitedFees": false, "lockTransactions": false}},
    //   "txCount": 87,
    //   "creation": {"to": "", "gas": "1175784", "from": "0xbaa68bf2cc7f57d810f328ef43256c7c1b071643", "hash": "0x66bf3cd2b7b408844f23dcfbd900fd00772396d4bf8327b78705add09f6b7e78", "input": "", "nonce": "2", "value": "0", "gasUsed": "1175784", "isError": "0", "gasPrice": "5000000000", "methodId": "0x60806040", "blockHash": "0x2d78e3f085b4f254979fb60db325b56548401295458b50321c968ee11bf3cf11", "timeStamp": "1662973450", "blockNumber": "21263751", "functionName": "atInversebrah(int248 a, uint48[] b, uint32 c, bytes20[] d, bytes30[] e)", "confirmations": "596193", "contractAddress": "0xb4b7b339949cc24b3508c4e37e252c2f982f3a41", "transactionIndex": "110", "txreceipt_status": "1", "cumulativeGasUsed": "11604569"},
    //   "exchange": "pancakev2", "reserve0": 6297248.913666908, "reserve1": 64796.917895408376, "createdAt": "2022-10-03T07:08:35.021Z", "liquidity": 129593.83579081677, "updatedAt": 1664814799, "tokenIndex": 0, "initialReserve0": 4990000, "initialReserve1": 49999.99999999999, "initialLiquidity": 100000, "reserveUpdatedAt": "2022-10-03T16:33:15.000Z", "createdAtTimestamp": 1664780911, "createdAtBlockNumber": 21859944, "initialLiquidityUpdatedAt": "2022-10-03T07:08:31.000Z"
    // },
    data: WBNB_HERO_pair,
    created_at: '2022-10-03 11:35:49.253',
    updated_at: '2022-10-03 16:33:19.244',
  };

  // const pair = await service.getPairById('ANM_BUSD_56_pancakev2');

  const r = await service.handleLpCreatedEvent(pair);
  console.log('{debug} r: ', r);
}
