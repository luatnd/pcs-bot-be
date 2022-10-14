import { Percent, Price, Trade } from '@pancakeswap/sdk';

export type QuotationResult = {
  trade: Trade;

  /*
  NOTE: for ***Price props:
    It's depend on route we will have ***Price will be token0/token1
    It's always be quote token
    It's always be ***Price = 1 quotes <=> ? base
    It means "sell price"
   */
  // midPrice is current price, right before executio, eq to token0/1Price right after create LP
  midPrice: Price;
  // Price display on Pancake, right at execution, 1 quotes = ? base
  executionPrice: Price;
  nextMidPrice: Price;
  priceImpact: Percent;

  // Minimum received on PCS UI?
  minimumAmountOut: string;

  // number of token amount of buyToken in LP, called `pooled amount` in dextool.io
  pooledTokenAmount0: string;
  // number of token amount of owningToken in LP
  pooledTokenAmount1: string;
  // 1 token0 = ? token1
  token0Price: string;
  // 1 token1 = ? token0
  token1Price: string;
};
