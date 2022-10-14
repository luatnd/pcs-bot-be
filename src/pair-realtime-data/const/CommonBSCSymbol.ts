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
/**
 * @deprecated Use CommonBscQuoteSymbol instead
 */
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
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // mainnet
    // address: '0xae13d989dac2f0debff460ac112a837c89baa7cd', // testnet
    decimal: 18,
    symbolBinance: 'BNBUSDT',
  },
  BNB: {
    symbol: 'BNB',
    // DEX use WBNB as mirror of BNB, native token has no address
    // But DEX use WBNB address to trade BNB
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
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

const CommonBscSymbolTestNet = JSON.parse(JSON.stringify(CommonBscSymbol));
CommonBscSymbolTestNet.WBNB.address = '0xae13d989dac2f0debff460ac112a837c89baa7cd';
CommonBscSymbolTestNet.BNB.address = CommonBscSymbolTestNet.WBNB.address;
CommonBscSymbolTestNet.CAKE.address = '0xFa60D973F7642B748046464e165A65B7323b0DEE';

const CommonBscQuoteSymbols = {
  56: CommonBscSymbol,
  97: CommonBscSymbolTestNet,
};

const chainId = Number(process.env.CHAIN_ID);
if (!chainId) {
  throw new Error('env CHAIN_ID was not set');
}

export const CommonBscQuoteSymbol: Record<string, CommonSymbol> = CommonBscQuoteSymbols[chainId];

// Key is lowercase address
export const CommonBscQuoteAddress = mapToDict(
  Object.values(CommonBscQuoteSymbol),
  (i) => i.symbol,
  (i) => i.address.toLowerCase(),
);
// console.log('{x} CommonBscQuoteSymbol: ', CommonBscQuoteSymbol);
// console.log('{x} CommonBscQuoteAddress: ', CommonBscQuoteAddress);
