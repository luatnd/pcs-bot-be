/* eslint-disable */
import { DtPair, DTResponseType } from './src/pair-info/type/dextool';

const poolListenReq = { jsonrpc: '2.0', method: 'subscribe', params: { chain: 'bsc', channel: 'bsc:pools' }, id: 2 };

const poolPairCreationRes: DTResponseType = {
  jsonrpc: '2.0',
  result: {
    status: 'ok',
    data: {
      pair: {
        creation: {
          blockNumber: '21382824',
          timeStamp: '1663332350',
          hash: '0xc402d7cc7eb33f7af565a863b48b9b0087e1593126b3197c134b4ebddcbe0e89',
          nonce: '0',
          blockHash: '0xf69a0df1150db4bddebd009087f85f51baa0fe590a864635c561cc0fa37e56b3',
          transactionIndex: '149',
          from: '0xadb239245864f8469b4f918c6832710e6d2b1512',
          to: '',
          value: '0',
          gas: '809853',
          gasPrice: '5000000000',
          isError: '0',
          txreceipt_status: '1',
          input: '',
          contractAddress: '0x234e1d120bffdcba913b89082979d4caa51de22f',
          cumulativeGasUsed: '14127852',
          gasUsed: '809853',
          confirmations: '346003',
          methodId: '0x60806040',
          functionName: 'atInversebrah(int248 a, uint48[] b, uint32 c, bytes20[] d, bytes30[] e)',
        },
        info: {
          locks: [],
          address: '0x234e1d120bffdcba913b89082979d4caa51de22f',
          holders: 71,
          decimals: 18,
          name: 'Stake To Own',
          symbol: 'STCK',
          totalSupply: '1000000000000000000000000000',
          maxSupplyFormatted: 1000000000,
          totalSupplyFormatted: 1000000000,
          totalSupplyFormattedUpdatedAt: '2022-09-28T16:08:04.398Z',
        },
        team: {
          wallet: '0xadb239245864f8469b4f918c6832710e6d2b1512',
        },
        _id: '63346b03e805927f8951d6b0',
        id: '0x6bb517ded0652e8cda918cf3d2c0df019312ae51',
        // @ts-ignore
        exchange: 'pancakev2',
        createdAt: '2022-09-28T15:40:51.055Z',
        updatedAt: 1664389888,
        __v: 1,
        createdAtBlockNumber: 21728827,
        createdAtTimestamp: 1664379646,
        token0: {
          _id: '63346b03e805927f8951d6c2',
          id: '0x234e1d120bffdcba913b89082979d4caa51de22f',
          name: 'Stake To Own',
          symbol: 'STCK',
          decimals: 18,
          audit: {
            _id: '633492ffe805927f8952c8c9',
            codeVerified: true,
            date: '2022-09-28T15:40:51.888Z',
            lockTransactions: false,
            mint: false,
            proxy: false,
            status: 'OK',
            unlimitedFees: false,
            version: 1,
          },
          totalSupply: '1000000000000000000000000000',
        },
        token1: {
          _id: '61dd397d91051aa34b108b2e',
          id: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
          decimals: 18,
          name: 'Wrapped BNB',
          symbol: 'WBNB',
          audit: {
            _id: '63346b03e805927f8951d6c4',
            codeVerified: true,
            date: '2022-08-18T11:35:46.823Z',
            lockTransactions: false,
            mint: false,
            proxy: false,
            status: 'OK',
            unlimitedFees: false,
            version: 1,
          },
        },
        tokenIndex: 0,
        type: 'standard-pair',
        initialReserve0: 117600000,
        initialReserve1: 133.2411038541738,
        initialLiquidity: 73755.93838769678,
        initialLiquidityUpdatedAt: '2022-09-28T15:40:46.000Z',
        liquidity: 31060.719075125737,
        reserve0: 283170871.3183756,
        reserve1: 55.823190855939714,
        reserveUpdatedAt: '2022-09-28T18:31:23.000Z',
        txCount: 904,
      },
      event: 'update',
    },
  },
  id: 2,
};

const pairInfoRes: DTResponseType = {
  jsonrpc: '2.0',
  result: {
    status: 'ok',
    data: {
      pair: {
        info: {
          locks: [],
          address: '0xf3e828cf25e810ddb987cf7a4b669b2a100ea7f0',
          holders: 91,
          decimals: 9,
          name: 'X Network',
          symbol: 'XNT',
          totalSupply: '100000000000000000',
          maxSupplyFormatted: 100000000,
          totalSupplyFormatted: 100000000,
          totalSupplyFormattedUpdatedAt: '2022-09-29T10:17:43.450Z',
        },
        _id: '63353b5312244480fb5379c6',
        id: '0x84dbafec5f2eea6129baef7698d1a7f03807ceaf',
        // @ts-ignore
        exchange: 'pancakev2',
        createdAt: '2022-09-29T06:29:39.338Z',
        updatedAt: 1664513603,
        __v: 1,
        createdAtBlockNumber: 21745803,
        createdAtTimestamp: 1664432976,
        token0: {
          _id: '61dd397d91051aa34b108b2e',
          id: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
          decimals: 18,
          name: 'Wrapped BNB',
          symbol: 'WBNB',
          audit: {
            _id: '63353b5312244480fb5379ce',
            codeVerified: true,
            date: '2022-08-18T11:35:46.823Z',
            lockTransactions: false,
            mint: false,
            proxy: false,
            status: 'OK',
            unlimitedFees: false,
            version: 1,
          },
        },
        token1: {
          _id: '63353b5312244480fb5379cf',
          id: '0xf3e828cf25e810ddb987cf7a4b669b2a100ea7f0',
          name: 'X Network',
          symbol: 'XNT',
          decimals: 9,
          audit: {
            _id: '6336764212244480fb5863ab',
            codeVerified: true,
            date: '2022-09-29T10:04:32.123Z',
            lockTransactions: false,
            mint: false,
            proxy: false,
            status: 'OK',
            unlimitedFees: false,
            version: 1,
          },
          totalSupply: '100000000000000000',
        },
        tokenIndex: 1,
        type: 'standard-pair',
        initialReserve0: 3,
        initialReserve1: 90000000,
        initialLiquidity: 1687.9111501102334,
        initialLiquidityUpdatedAt: '2022-09-29T07:26:37.000Z',
        liquidity: 3911.334944029774,
        reserve0: 6.880274644960658,
        reserve1: 40422470.99705085,
        reserveUpdatedAt: '2022-09-30T04:53:20.000Z',
        txCount: 500,
      },
      event: 'update',
    },
  },
  id: 2,
};

const fakeAnmBUsdPair = {
  id: 'fake_ANM_BUSD',
  __v: 1,
  _id: '633a8a72104e078179d51941',
  info: {
    name: 'Animverse',
    locks: [],
    symbol: 'ANM',
    address: '0x7470FF44A57FCe4b7413F31Fdc9b625ff58dBb9c',
    holders: 60,
    decimals: 18,
    totalSupply: '1200000000000000000000000000',
    maxSupplyFormatted: 1200000000,
    totalSupplyFormatted: 1200000000,
    totalSupplyFormattedUpdatedAt: '2022-10-03T07:35:10.346Z',
  },
  team: { wallet: '0xbaa68bf2cc7f57d810f328ef43256c7c1b071643' },
  type: 'stable-based-pair',
  token0: {
    id: '0x7470FF44A57FCe4b7413F31Fdc9b625ff58dBb9c',
    _id: '633a8a73104e078179d51948',
    name: 'Animverse',
    audit: {
      _id: '633b0ecf104e078179d6cebe',
      date: '2022-10-03T07:08:55.242Z',
      mint: false,
      proxy: false,
      status: 'OK',
      version: 1,
      codeVerified: true,
      unlimitedFees: false,
      lockTransactions: false,
    },
    symbol: 'ANM',
    decimals: 18,
    totalSupply: '1200000000000000000000000000',
  },
  token1: {
    id: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    _id: '61ddc3a091051aa34b80874c',
    name: 'BUSD Token',
    audit: {
      _id: '633a8a73104e078179d5194a',
      date: '2022-10-03T14:51:55.142Z',
      mint: true,
      proxy: false,
      status: 'OK',
      version: 1,
      codeVerified: true,
      unlimitedFees: false,
      lockTransactions: false,
    },
    symbol: 'BUSD',
    decimals: 18,
    totalSupply: '4850999126369409465655005310',
  },
  txCount: 87,
  creation: {
    to: '',
    gas: '1175784',
    from: '0xbaa68bf2cc7f57d810f328ef43256c7c1b071643',
    hash: '0x66bf3cd2b7b408844f23dcfbd900fd00772396d4bf8327b78705add09f6b7e78',
    input: '',
    nonce: '2',
    value: '0',
    gasUsed: '1175784',
    isError: '0',
    gasPrice: '5000000000',
    methodId: '0x60806040',
    blockHash: '0x2d78e3f085b4f254979fb60db325b56548401295458b50321c968ee11bf3cf11',
    timeStamp: '1662973450',
    blockNumber: '21263751',
    functionName: 'atInversebrah(int248 a, uint48[] b, uint32 c, bytes20[] d, bytes30[] e)',
    confirmations: '596193',
    contractAddress: '0xb4b7b339949cc24b3508c4e37e252c2f982f3a41',
    transactionIndex: '110',
    txreceipt_status: '1',
    cumulativeGasUsed: '11604569',
  },
  exchange: 'pancakev2',
  reserve0: 6297248.913666908,
  reserve1: 64796.917895408376,
  createdAt: '2022-10-03T07:08:35.021Z',
  liquidity: 129593.83579081677,
  updatedAt: 1664814799,
  tokenIndex: 0,
  initialReserve0: 4990000,
  initialReserve1: 49999.99999999999,
  initialLiquidity: 100000.0,
  reserveUpdatedAt: '2022-10-03T16:33:15.000Z',
  createdAtTimestamp: 1664780911,
  createdAtBlockNumber: 21859944,
  initialLiquidityUpdatedAt: '2022-10-03T07:08:31.000Z',
};

// get from dex tool: pair screen, see api /search?p=xxxx
export const WBNB_HERO_pair: DtPair = {
  _id: '6112672ca2b34485c992451b',
  id: '0xe267018c943e77992e7e515724b07b9ce7938124',
  createdAtTimestamp: 1625501153,
  // @ts-ignore
  exchange: 'pancakev2',
  type: 'standard-pair',
  token0: {
    id: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    name: 'Wrapped BNB',
    symbol: 'WBNB',
    // @ts-ignore
    decimals: '18',
    // @ts-ignore
    audit: {
      codeVerified: true,
      date: '2022-08-18T11:06:38.380Z',
      lockTransactions: false,
      mint: false,
      proxy: false,
      status: 'OK',
      unlimitedFees: false,
      version: 1,
    },
    totalSupply: '4312659382328442086888514',
  },
  token1: {
    id: '0xd40bedb44c081d2935eeba6ef5a3c8a31a1bbe13',
    name: 'Metahero',
    symbol: 'HERO',
    // @ts-ignore
    decimals: '18',
    // @ts-ignore
    audit: {
      codeVerified: true,
      date: '2022-09-01T23:46:11.332Z',
      lockTransactions: false,
      mint: true,
      proxy: false,
      status: 'OK',
      unlimitedFees: false,
      version: 1,
    },
    totalSupply: '9766213274195872160839915066',
  },
  tokenIndex: 1,
  __v: 1,
  initialReserve0: 20663.5354711998,
  initialReserve1: 1161314833.53849,

  creation: {
    blockNumber: '8894738',
    timeStamp: '1625501137',
    hash: '0x46c3df970cbbac7b7bc03063799b6cfff6e559ea4644916689cf69c03114c02f',
    nonce: '56',
    blockHash: '0xcd3ca712edd8b8fbe846707990eed370a150e4e1ec32da8ff59a1cd13f208574',
    transactionIndex: '3',
    from: '0x3531db095f19b21b7cdf0300c25cec817335a6a4',
    to: '',
    value: '0',
    gas: '5017060',
    gasPrice: '10000000000',
    isError: '0',
    txreceipt_status: '1',
    input: '',
    contractAddress: '0xd40bedb44c081d2935eeba6ef5a3c8a31a1bbe13',
    cumulativeGasUsed: '5121354',
    gasUsed: '5017060',
    confirmations: '198994',
  },
  reserve0: 22142.24380941286,
  reserve1: 1551173160.2178957,
  reserveUpdatedAt: '2022-10-05T15:49:43.000Z',
  info: {
    address: '0xd40bedb44c081d2935eeba6ef5a3c8a31a1bbe13',
    name: 'Metahero',
    symbol: 'HERO',
    totalSupply: '9766213274195872160839915066',
    decimals: 18,
    fullyDilutedMarketCap: 1.228265775428145e27,
    marketCap: 1.228270882113985e27,
    remainingSupply: '9.766253878586254e+27',
    remainingSupplyUpdatedAt: '2021-11-04T10:04:31.426Z',
    holders: 228936,
    fullyDilutedMarketCapFormatted: 135516432.651278,
    marketCapFormatted: 132272672.32666275,
    totalSupplyFormatted: 9766212798.573004,
    totalSupplyFormattedUpdatedAt: '2022-10-02T21:30:11.965Z',
    maxSupplyFormatted: 9766213274.195873,
    locks: [],
  },
  txCount: 2325695,
  createdAt: '2021-08-30T19:39:33.408Z',
  updatedAt: '2022-10-05T15:49:46.055Z',
  initialLiquidity: 21887404.057288602,
  initialLiquidityUpdatedAt: '2021-12-18T13:03:42.191Z',
  liquidity: 12960170.49517939,
};
