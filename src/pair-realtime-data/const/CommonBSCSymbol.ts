import { mapToDict } from '../../utils/Array';
import { ContractAddress } from '../../pair-info/type/dextool';

type UpperCaseSymbol = string;
type CommonSymbol = {
  symbol: string;
  address: ContractAddress;
  decimal: number;
  isStableCoin?: boolean;
  symbolBinance?: string;
};
export const CommonBscSymbol: Record<UpperCaseSymbol, CommonSymbol> = {
  BUSD: {
    symbol: 'BUSD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    decimal: 18,
    isStableCoin: true,
  },
  USDT: {
    symbol: 'USDT',
    address: '0x55d398326f99059ff775485246999027b3197955',
    decimal: 18,
    isStableCoin: true,
  },
  WBNB: {
    symbol: 'WBNB',
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    decimal: 18,
    symbolBinance: 'BNBUSDT',
  },
  BNB: {
    symbol: 'BNB',
    address: 'NATIVE_TOKEN_HAS_NO_ADDRESS',
    decimal: 18,
    symbolBinance: 'BNBUSDT',
  },
  CAKE: {
    symbol: 'Cake',
    address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    decimal: 18,
    symbolBinance: 'CAKEUSDT',
  },
};

export const CommonBscQuoteSymbol = CommonBscSymbol;
export const CommonBscQuoteAddress = mapToDict(
  Object.values(CommonBscSymbol),
  (i) => i.symbol,
  (i) => i.address,
);
