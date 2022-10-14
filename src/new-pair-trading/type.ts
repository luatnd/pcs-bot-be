import { QuotationResult } from '../pancakeswap-v2/type';
import { Token } from '@pancakeswap/sdk';

export type ValidateQuotation = {
  base: Token;
  quote: Token;
  quotes: QuotationResult;
  maxPriceImpactPercent: number;
  quoteTokenAmountToSell: number;
};
