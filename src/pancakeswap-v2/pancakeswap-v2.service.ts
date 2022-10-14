/* eslint-disable max-len */
import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { Fetcher, Pair, Percent, Route, Token, TokenAmount, Trade, TradeType } from '@pancakeswap/sdk';
import { Contract, ethers, Wallet } from 'ethers';
import { ConfigService } from '@nestjs/config';
import EthersServer from '../blockchain/_utils/EthersServer';
import { AppError } from '../../libs/errors/base.error';
import { CommonBscQuoteSymbol } from '../pair-realtime-data/const/CommonBSCSymbol';
import { round } from '../utils/number';
import { QuotationResult } from './type';

export type AppSwapOption = {
  gasPrice?: number; // in wei
  gasLimit?: number; // in wei
};
type AppSwapFn = 'swapExactETHForTokens' | 'swapExactTokensForETH' | 'swapExactTokensForTokens';

@Injectable()
export class PancakeswapV2Service {
  private readonly logger = new Logger(PancakeswapV2Service.name);
  private readonly ethersServer = new EthersServer();
  private chainId = 0;

  private provider: ethers.providers.BaseProvider;
  private routerContract: Contract;
  private wallet: Wallet;

  public SLIPPAGE_DENOMINATOR = 10000;

  constructor(private configService: ConfigService) {
    this.provider = this.getAppProvider();

    const chainId = Number(this.configService.get<string>('CHAIN_ID'));
    this.chainId = chainId;
    this.logger.log('{PancakeswapV2Service.constructor} chainId=' + chainId);

    const routerAddress = this.configService.get<string>('ROUTER_CONTRACT');
    if (!routerAddress) {
      throw new Error('Invalid routerAddress');
    }
    const routerAbi = fs.readFileSync('./src/pancakeswap-v2/abi/pcs-router-v2.json').toString();
    if (!routerAbi) {
      throw new Error('Invalid routerAbi');
    }
    this.routerContract = this.ethersServer.getContract(routerAddress, routerAbi, this.provider);

    this.wallet = this.getAppWallet();
  }

  async getQuotation(
    buyToken: Token,
    owningToken: Token,
    owningSellAmount: string,
    slippage = '50',
  ): Promise<QuotationResult> {
    this.logger.log(
      '{getQuotation} buyToken/owningToken, amount, slippage: ' +
        `${buyToken.symbol}/${owningToken.symbol}, ${owningSellAmount} token, ${Number(
          new Percent(slippage, this.SLIPPAGE_DENOMINATOR).toSignificant(),
        )}%`,
    );
    const provider = this.provider;

    const pair: Pair = await Fetcher.fetchPairData(buyToken, owningToken, provider); //creating instances of a pair

    /*
    NOTE:
    token0 & token1 is in sorted order, not the buyToken / owningToken as we expect,
    plz see the Solidity code:

    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
    }

     */

    // https://docs.uniswap.org/sdk/2.0.0/reference/trade
    const route = await new Route([pair], owningToken); // a fully specified path from input token to output token
    // console.log('{swapExactETHForToken} route: ', route);
    // console.log('{swapExactETHForToken} route.pairs: ', JSON.stringify(route.pairs[0]));
    // console.log('{swapExactETHForToken} mid_price: ', route.midPrice.toSignificant()); // 1 buyToken = ? owningToken
    // console.log('{getQuotation} pair: ', pair);
    // const totalLpUsd = pooledTokenAmountBase * basePriceUsd + pooledTokenAmountQuote * quotePriceUsd;

    const amountInBN = ethers.utils.parseEther(owningSellAmount.toString()); //helper function to convert ETH to Wei
    const amountIn = amountInBN.toString();

    const slippageTolerance = new Percent(slippage, this.SLIPPAGE_DENOMINATOR); // 50 bips, or 0.50% - Slippage tolerance

    // https://docs.uniswap.org/sdk/2.0.0/reference/trade
    // information necessary to create a swap transaction.
    const trade = new Trade(route, new TokenAmount(owningToken, amountIn), TradeType.EXACT_INPUT);

    // console.log('{swapExactETHForToken} trade: ', trade);
    // console.log('{swapExactETHForToken} trade.executionPrice: ', trade.executionPrice.toSignificant());
    // console.log('{swapExactETHForToken} trade.nextMidPrice: ', trade.nextMidPrice.toSignificant());
    // console.log('{swapExactETHForToken} trade.priceImpact: ', trade.priceImpact.toSignificant());

    // Only for input as buyToken: Minimum received if buying in gwei
    const minimumAmountOut = trade.minimumAmountOut(slippageTolerance).raw.toString();
    // Only for input as owningToken: Maximum sold if selling in gwei
    // const maximumAmountIn = trade.maximumAmountIn(slippageTolerance).raw.toString();

    // console.log(
    //   '{PancakeswapV2Service.swapExactETHForToken} minimumAmountOut, maximumAmountIn: ',
    //   minimumAmountOut,
    //   maximumAmountIn,
    // );

    return {
      trade,

      /*
      NOTE: for ***Price props:
        It's depend on route we will have ***Price will be token0/token1
        It's always be quote token
        It's always be ***Price = 1 quotes <=> ? base
        It means "sell price"
       */
      // midPrice is current price, right before executio, eq to token0/1Price right after create LP
      midPrice: route.midPrice,
      // Price display on Pancake, right at execution, 1 quotes = ? base
      executionPrice: trade.executionPrice,
      nextMidPrice: trade.nextMidPrice,
      priceImpact: trade.priceImpact,

      // Minimum received on PCS UI?
      minimumAmountOut,

      // number of token amount of buyToken in LP, called `pooled amount` in dextool.io
      pooledTokenAmount0: pair.reserve0.toSignificant(),
      // number of token amount of owningToken in LP
      pooledTokenAmount1: pair.reserve1.toSignificant(),
      // 1 token0 = ? token1
      token0Price: pair.token0Price.toSignificant(),
      // 1 token1 = ? token0
      token1Price: pair.token1Price.toSignificant(),
    };
  }

  async swapUnsafe(
    buyToken: Token,
    owningToken: Token,
    owningSellAmount: string,
    slippage = '50',
    options?: AppSwapOption,
  ) {
    const quotes = await this.getQuotation(buyToken, owningToken, owningSellAmount, slippage);

    this.logger.log('{tryPlaceEntry} quotes: ', {
      trade: '... => Complex object',
      midPrice: quotes.midPrice.toSignificant(),
      executionPrice: quotes.executionPrice.toSignificant(),
      nextMidPrice: quotes.nextMidPrice.toSignificant(),
      priceImpact: quotes.priceImpact.toSignificant(),
      minimumAmountOut: quotes.minimumAmountOut,
      // number of token amount of base in LP
      pooledTokenAmount0: quotes.pooledTokenAmount0,
      // number of token amount of quote in LP
      pooledTokenAmount1: quotes.pooledTokenAmount1,
      // 1 base = x quote
      token0Price: quotes.token0Price,
      // 1 quote = x base
      token1Price: quotes.token1Price,
    });

    return this.swapTokensWithTradeObject(quotes.trade, quotes.minimumAmountOut, buyToken, owningToken, options);
  }

  /**
   * @throws Error
   */
  async swapTokensWithTradeObject(
    trade: Trade,
    minimumAmountOut: string,
    buyToken: Token,
    sellToken: Token,
    options?: AppSwapOption,
  ) {
    this.logger.log('{swapTokensWithTradeObject} ' + `${sellToken.symbol} => ${buyToken.symbol}`);
    const durationStart = Date.now();
    const wallet = this.wallet;

    const amountOutMinHex = ethers.BigNumber.from(minimumAmountOut).toHexString();

    const path = [sellToken.address, buyToken.address]; //An array of token addresses
    const to = wallet.address; // should be a checksummed recipient address
    const nextUnixDeadline = Math.floor(Date.now() / 1000) + 60 * 2; // secs unit
    const inputAmountWei = trade.inputAmount.raw; // needs to be converted to e.g. hex
    const inputAmountWeiHex = ethers.BigNumber.from(inputAmountWei.toString()).toHexString();
    const inputAmountInToken = Number(inputAmountWei) / Math.pow(10, sellToken.decimals);
    this.logger.log(
      `{swapTokensWithTradeObject} inputAmountWei: ${inputAmountWei} ${inputAmountWeiHex}` +
        ` = ${inputAmountInToken} ${sellToken.symbol} | received >= minimumAmountOut = ${minimumAmountOut} ${amountOutMinHex}`,
    );
    const valueHex = ethers.BigNumber.from(inputAmountWei.toString()).toHexString(); //convert to hex string

    const gasPrice = options?.gasPrice;

    // Return a copy of transactionRequest,
    // The default implementation calls checkTransaction and resolves to if it
    // is an ENS name, adds gasPrice, nonce, gasLimit and chainId based on
    // the related operations on Signer.

    // TODO: This is case WBNB to Token => swapExactTokensForTokens
    // TODO: To know which fn that pancake call,
    //  => just check data tab of transaction while confirming on metamask
    const swapFn = this.getSwapFn(buyToken, sellToken);
    const swap = this.routerContract.populateTransaction[swapFn];

    const swapOpt: Record<string, any> = {
      // value: valueHex,
      // gasPrice: (1e10).toString(), // 10 gwei
      gasLimit: (4e5).toString(), // 185829 is on metamask testnet
    };
    if (gasPrice && Number.isInteger(gasPrice)) {
      swapOpt.gasPrice = gasPrice;
    }

    this.logger.log(
      `{swapTokensWithTradeObject} ${swapFn} ${inputAmountInToken} ${sellToken.symbol} => ? ${buyToken.symbol}`,
    );
    let rawTxn: ethers.PopulatedTransaction;
    switch (swapFn) {
      case 'swapExactETHForTokens':
        /*
        function swapExactETHForTokens(
          uint amountOutMin, address[] calldata path, address to, uint deadline
        ) external payable returns (uint[] memory amounts);
         */
        rawTxn = await swap(amountOutMinHex, path, to, nextUnixDeadline, {
          ...swapOpt,
          value: valueHex,
        });
        break;
      case 'swapExactTokensForETH':
        /*
        function swapExactTokensForETH(
          uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
        ) external returns (uint[] memory amounts);
         */
        rawTxn = await swap(inputAmountWeiHex, amountOutMinHex, path, to, nextUnixDeadline, swapOpt);
        break;
      case 'swapExactTokensForTokens':
        /*
        function swapExactTokensForTokens(
          uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
        ) external returns (uint[] memory amounts);

        Issue 1: https://www.followchain.org/insufficient-output-amount-pancakeswap/
        => Fixed by inputAmountWeiHex is wrong and got a token value instead of wei value
         */
        rawTxn = await swap(inputAmountWeiHex, amountOutMinHex, path, to, nextUnixDeadline, swapOpt);
        break;
      default:
        throw new AppError('Unhandled swapFn ' + swapFn, 'SwapFnInvalid');
    }
    this.logger.log('{PancakeswapV2Service.swapTokensWithTradeObject} rawTxn: ', rawTxn);

    //Returns a Promise which resolves to the transaction.
    let sendTxn: ethers.providers.TransactionResponse;
    try {
      sendTxn = await wallet.sendTransaction(rawTxn);
    } catch (e) {
      if (e.code === 'INSUFFICIENT_FUNDS') {
        // eslint-disable-next-line max-len
        throw new AppError(
          '{swapTokensWithTradeObject} sendTransaction: insufficient funds for intrinsic transaction cost',
          e.code,
        );
      }

      console.log('{swapTokensWithTradeObject} sendTransaction e.code: ' + e.code);
      throw e;
    }

    let receipt: ethers.providers.TransactionReceipt;
    try {
      //Resolves to the TransactionReceipt once the transaction has been included in the chain for x confirms blocks.
      receipt = await sendTxn.wait();
    } catch (e) {
      console.log('{swapTokensWithTradeObject} tx.wait e.code, e: ' + e.code, e);
      throw e;
    }

    const durationStop = Date.now();

    //Logs the information about the transaction it has been mined.
    const rc = this.normalizeReceipt(receipt);
    this.logger.log('{swapTokensWithTradeObject} SUCCESS with receipt: ', rc);

    // TODO: PCS UI price is delayed 10-20s after tx succeeded, is router contract price delayed too?

    return {
      ...rc,
      duration: round((durationStop - durationStart) / 1000, 2),
    };
  }

  normalizeReceipt(r: ethers.providers.TransactionReceipt): {
    transactionHash: any;
    blockNumber: any;
    to: any;
    from: any;
    gasUsed: any;
    cumulativeGasUsed: any;
    effectiveGasPrice: any;
    byzantium: any;
    confirmations: any;
    status: any;
    type: any;
  } {
    return {
      transactionHash: r.transactionHash,
      blockNumber: r.blockNumber,
      to: r.to,
      from: r.from,
      gasUsed: r.gasUsed.toString(),
      cumulativeGasUsed: r.cumulativeGasUsed.toString(),
      effectiveGasPrice: r.effectiveGasPrice.toString(),
      byzantium: r.byzantium,
      confirmations: r.confirmations,
      status: r.status,
      type: r.type,
    };
  }

  // This is action for this bot only, other bot will have some more other actions
  getSwapFn(buyToken: Token, sellToken: Token): AppSwapFn {
    if (this.isNativeToken(sellToken.address)) {
      // buy: fixed BNB > Token
      return 'swapExactETHForTokens';
    } else if (this.isNativeToken(buyToken.address)) {
      // sell: fixed token > BNB
      return 'swapExactTokensForETH';
    } else {
      // buy / sell: fixed token > token
      return 'swapExactTokensForTokens';
    }
  }

  isNativeToken(address: string): boolean {
    // NOTE: CommonBscQuoteSymbol is already been dynamically base on chain_id
    // address is case-insensitive
    return address.toLowerCase() === CommonBscQuoteSymbol.WBNB.address.toLowerCase();
  }

  getChainId() {
    return this.chainId;
  }

  getToken(chainId: number, address: string, decimal: number, symbol?: string): Token {
    return new Token(chainId, address, decimal, symbol);
  }

  getAppToken(address: string, decimal: number, symbol?: string, name?: string): Token {
    return new Token(this.getChainId(), address, decimal, symbol, name);
  }

  getAppProvider(): ethers.providers.BaseProvider {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    return this.ethersServer.getProvider(rpcUrl);
  }

  getAppWallet() {
    const privateKey = this.configService.get<string>('WALLET_PK');
    return this.ethersServer.getWallet(privateKey, this.provider);
  }
}
