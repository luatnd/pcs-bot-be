export type DTResponseType = {
  id: number;
  jsonrpc: string;
  result: ResponseResultType;
};

export type ResponseResultType = {
  status: string;
  data: PairEventDataType | NativeCurrencyPriceEventDataType;
};

export type PairEventDataType = {
  event: string;
  pair: DtPair;
};

export type NativeCurrencyPriceEventDataType = {
  ethPriceUsd: number;
  ethTimestampUsd: number;
};

export enum DtExchange {
  pancakev2 = 'pancakev2',
}

export type DateStringISO = string;
export type DateUnix = number;
export type ContractAddress = string;
export type DtPair = DtPairStaticData & DtPairDynamicData;
export type DtPairStaticData = {
  creation?: DtOnChainCreation;
  info: {
    locks: Array<any>;
    address: ContractAddress;
    holders: number;
    decimals: number;
    name: string;
    symbol: string;
    totalSupply: string; // wei string
    maxSupplyFormatted: number;
    totalSupplyFormatted: number;
    totalSupplyFormattedUpdatedAt: DateStringISO;

    // this field from api
    fullyDilutedMarketCap?: number;
    marketCap?: number;
    remainingSupply?: string;
    remainingSupplyUpdatedAt?: DateStringISO;
    fullyDilutedMarketCapFormatted?: number;
    marketCapFormatted?: number;
  };
  team: {
    wallet: string;
  };

  _id: string; // uid in mongo db ?
  id: string; // contract address ?
  exchange: DtExchange;
  createdAt: DateStringISO;
  updatedAt: DateUnix | DateStringISO;
  __v: number;
  createdAtBlockNumber: number;
  createdAtTimestamp: DateUnix;

  token0: DTToken;
  token1: DTToken;

  tokenIndex: number;
  type: string;
};
export type DtPairDynamicData = {
  // for trading
  initialReserve0: number;
  initialReserve1: number;
  initialLiquidity: number;
  initialLiquidityUpdatedAt: DateStringISO;
  liquidity: number;
  reserve0: number;
  reserve1: number;
  reserveUpdatedAt: DateStringISO;
  // end for trading

  txCount: number;
};

export type DtOnChainCreation = {
  blockNumber: string; // block num in str
  timeStamp: string; // unix ts in str
  hash: string;
  nonce: string; // nonce number in string
  blockHash: string;
  transactionIndex: string;
  from: ContractAddress;
  to: ContractAddress;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: ContractAddress;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId?: string;
  functionName?: string;
};

export type DTToken = {
  _id: string;
  id: ContractAddress;
  decimals: number;
  name: string;
  symbol: string;
  audit: {
    _id: string;
    codeVerified: boolean;
    date: DateStringISO;
    lockTransactions: boolean;
    mint: boolean;
    proxy: boolean;
    status: string;
    unlimitedFees: boolean;
    version: number;
  };
  totalSupply?: string;
};
