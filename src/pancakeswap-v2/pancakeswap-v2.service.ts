import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { ChainId, Fetcher, Percent, Route, Token, TokenAmount, Trade, TradeType, WETH } from '@pancakeswap/sdk';
import { Contract, ethers, Wallet } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { ContractAddress } from '../pair-info/type/dextool';
import EthersServer from '../blockchain/_utils/EthersServer';

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

  async getQuotes(baseAddress: ContractAddress, quoteAddress: ContractAddress, baseAmountInToken: number) {
    // TODO: Urgent here

    const DAI = new Token(this.getChainId(), '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18);

    // note that you may want/need to handle this async code differently,
    // for example if top-level await is not an option
    const pair = await Fetcher.fetchPairData(DAI, WETH[DAI.chainId]);

    const route = new Route([pair], WETH[DAI.chainId]);

    const trade = new Trade(route, new TokenAmount(WETH[DAI.chainId], '1000000000000000000'), TradeType.EXACT_INPUT);

    console.log(trade.executionPrice.toSignificant(6));
    console.log(trade.nextMidPrice.toSignificant(6));
  }

  async swap() {
    //
  }

  /**
   * @throws Error
   */
  async swapExactETHForToken(base: Token, quote: Token, amount: string, slippage = '50') {
    const provider = this.provider;
    const wallet = this.wallet;

    const pair = await Fetcher.fetchPairData(base, quote, provider); //creating instances of a pair
    const route = await new Route([pair], base); // a fully specified path from input token to output token
    // console.log('{swapExactETHForToken} route: ', route);
    // console.log('{swapExactETHForToken} route.pairs: ', JSON.stringify(route.pairs[0]));
    console.log('{swapExactETHForToken} mid_price: ', route.midPrice.toSignificant()); // 1 base = ? quote

    const amountInBN = ethers.utils.parseEther(amount.toString()); //helper function to convert ETH to Wei
    const amountIn = amountInBN.toString();

    const slippageTolerance = new Percent(slippage, '10000'); // 50 bips, or 0.50% - Slippage tolerance

    // information necessary to create a swap transaction.
    const trade = new Trade(route, new TokenAmount(base, amountIn), TradeType.EXACT_INPUT);

    // console.log('{swapExactETHForToken} trade: ', trade);
    console.log('{swapExactETHForToken} trade.executionPrice: ', trade.executionPrice.toSignificant());
    console.log('{swapExactETHForToken} trade.nextMidPrice: ', trade.nextMidPrice.toSignificant());
    console.log('{swapExactETHForToken} trade.priceImpact: ', trade.priceImpact.toSignificant());

    // Only for input as base: Minimum received if buying in gwei
    const minimumAmountOut = trade.minimumAmountOut(slippageTolerance).raw.toString();
    // Only for input as quote: Maximum sold if selling in gwei
    const maximumAmountIn = trade.maximumAmountIn(slippageTolerance).raw.toString();

    console.log(
      '{PancakeswapV2Service.swapExactETHForToken} minimumAmountOut, maximumAmountIn: ',
      minimumAmountOut,
      maximumAmountIn,
    );

    const amountOutMinHex = ethers.BigNumber.from(minimumAmountOut).toHexString();

    const path = [base.address, quote.address]; //An array of token addresses
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
      { value: valueHex },
    );

    //Returns a Promise which resolves to the transaction.
    let sendTxn: ethers.providers.TransactionResponse;
    try {
      sendTxn = await wallet.sendTransaction(rawTxn);
    } catch (e) {
      console.log('{swapExactETHForToken.sendTransaction} e.code, e: ' + e.code, e);

      if (e.code === 'INSUFFICIENT_FUNDS') {
      }

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
  }

  getChainId() {
    return this.MainNet ? ChainId.MAINNET : ChainId.TESTNET;
  }

  getToken(chainId: number, address: string, decimal: number, symbol?: string): Token {
    return new Token(chainId, address, decimal, symbol);
  }

  getAppToken(address: string, decimal: number, symbol?: string): Token {
    return new Token(this.getChainId(), address, decimal, symbol);
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
