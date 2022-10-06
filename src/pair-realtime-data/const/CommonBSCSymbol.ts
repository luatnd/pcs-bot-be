type UpperCaseSymbol = string;
export const CommonBscSymbol: Record<
  UpperCaseSymbol,
  {
    symbol: string;
    address: string;
    decimal: number;
    isStableCoin?: boolean;
    symbolBinance?: string;
  }
> = {
  BUSD: {
    symbol: 'BUSD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
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
    address: '',
    decimal: 18,
    symbolBinance: 'BNBUSDT',
  },
  USDT: {
    symbol: 'USDT',
    address: '',
    decimal: 18,
    isStableCoin: true,
  },
  CAKE: {
    symbol: 'Cake',
    address: '',
    decimal: 18,
    symbolBinance: 'CAKEUSDT',
  },
};

export const CommonBscQuoteSymbol = CommonBscSymbol;
