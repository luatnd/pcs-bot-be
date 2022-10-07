import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { ChainId, Fetcher, Pair, Percent, Route, Token, TokenAmount, Trade, TradeType } from '@pancakeswap/sdk';
import { Contract, ethers, Wallet } from 'ethers';
import { ConfigService } from '@nestjs/config';
import EthersServer from '../blockchain/_utils/EthersServer';
import { AppError } from '../../libs/errors/base.error';

@Injectable()
export class PancakeswapV2Service {
  private readonly logger = new Logger(PancakeswapV2Service.name);
  private readonly ethersServer = new EthersServer();
  private MainNet = true;

  private provider: ethers.providers.BaseProvider;
  private routerContract: Contract;
  private wallet: Wallet;

  constructor(private configService: ConfigService) {
    this.provider = this.getAppProvider();

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

  async getQuotation(buyToken: Token, owningToken: Token, owningSellAmount: string, slippage = '50') {
    this.logger.log(
      '{getQuotation} buyToken/owningToken, amount, slippage: ' +
        `${buyToken.symbol}/${owningToken.symbol}, ${owningSellAmount} token, ${Number(
          new Percent(slippage, '10000').toSignificant(),
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

    const slippageTolerance = new Percent(slippage, '10000'); // 50 bips, or 0.50% - Slippage tolerance

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

      midPrice: route.midPrice,
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

  async swapUnsafe(buyToken: Token, sellToken: Token, amount: string, slippage = '50') {
    const { trade, minimumAmountOut } = await this.getQuotation(buyToken, sellToken, amount, slippage);
    return this.swapExactETHForTokenWithTradeObject(trade, minimumAmountOut, buyToken, sellToken);
  }

  /**
   * @throws Error
   */
  async swapExactETHForTokenWithTradeObject(
    trade: Trade,
    minimumAmountOut: string,
    buyToken: Token,
    sellToken: Token,
    // amount: string,
    // slippage = '50',
  ) {
    this.logger.log(
      '{swapExactETHForTokenWithTradeObject} buyToken, sellToken, minimumAmountOut: ' +
        `${buyToken.symbol}, ${sellToken.symbol}, ${minimumAmountOut}`,
    );

    const wallet = this.wallet;

    const amountOutMinHex = ethers.BigNumber.from(minimumAmountOut).toHexString();

    const path = [buyToken.address, sellToken.address]; //An array of token addresses
    const to = wallet.address; // should be a checksummed recipient address
    const deadlineInSecs = Math.floor(Date.now() / 1000) + 60 * 5; // 20 minutes from the current Unix time
    const inputAmount = trade.inputAmount.raw; // // needs to be converted to e.g. hex
    const valueHex = ethers.BigNumber.from(inputAmount.toString()).toHexString(); //convert to hex string

    // Return a copy of transactionRequest,
    // The default implementation calls checkTransaction and resolves to if it
    // is an ENS name, adds gasPrice, nonce, gasLimit and chainId based on
    // the related operations on Signer.
    const rawTxn = await this.routerContract.populateTransaction.swapExactETHForTokens(
      amountOutMinHex,
      path,
      to,
      deadlineInSecs,
      {
        value: valueHex,
        // gasPrice: "100000000000" // 100 gwei
      },
    );

    //Returns a Promise which resolves to the transaction.
    let sendTxn: ethers.providers.TransactionResponse;
    try {
      sendTxn = await wallet.sendTransaction(rawTxn);
    } catch (e) {
      if (e.code === 'INSUFFICIENT_FUNDS') {
        // eslint-disable-next-line max-len
        throw new AppError(
          'swapExactETHForToken.sendTransaction: insufficient funds for intrinsic transaction cost',
          e.code,
        );
      }

      console.log('{swapExactETHForToken.sendTransaction} e.code: ' + e.code);
      throw e;
    }

    let receipt: ethers.providers.TransactionReceipt;
    try {
      //Resolves to the TransactionReceipt once the transaction has been included in the chain for x confirms blocks.
      receipt = await sendTxn.wait();
    } catch (e) {
      console.log('{swapExactETHForToken.wait} e.code, e: ' + e.code, e);
      throw e;
    }

    //Logs the information about the transaction it has been mined.
    console.log('{swapExactETHForToken} receipt: ', receipt);
    console.log(
      ' - Transaction is mined - ' +
        '\n' +
        'Transaction Hash:' +
        sendTxn.hash +
        '\n' +
        'Block Number: ' +
        receipt.blockNumber +
        '\n' +
        'Navigate to https://bscscan.io/tx/' +
        sendTxn.hash +
        ' to see your transaction',
    );

    // TODO:
  }

  getChainId() {
    return this.MainNet ? ChainId.MAINNET : ChainId.TESTNET;
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
