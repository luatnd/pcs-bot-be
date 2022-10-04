import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { ChainId, Fetcher, Percent, Route, Token, TokenAmount, Trade, TradeType, WETH } from '@pancakeswap/sdk';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { ContractAddress } from '../pair-info/type/dextool';
import EthersServer from '../blockchain/_utils/EthersServer';

@Injectable()
export class PancakeswapV2Service {
  private readonly logger = new Logger(PancakeswapV2Service.name);
  private readonly ethersServer = new EthersServer();
  private MainNet = false;

  private provider;
  private routerContract;
  private wallet;

  constructor(private configService: ConfigService) {
    this.provider = this.getAppProvider();

    const routerAddress = this.configService.get<string>('ROUTER_CONTRACT');
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
    const route = await new Route([pair], quote); // a fully specified path from input token to output token
    const amountInBN = ethers.utils.parseEther(amount.toString()); //helper function to convert ETH to Wei
    const amountIn = amountInBN.toString();

    const slippageTolerance = new Percent(slippage, '10000'); // 50 bips, or 0.50% - Slippage tolerance

    // information necessary to create a swap transaction.
    const trade = new Trade(route, new TokenAmount(quote, amountIn), TradeType.EXACT_INPUT);

    const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
    console.log('{PancakeswapV2Service.swapExactETHForToken} amountOutMin: ', amountOutMin);

    const amountOutMinHex = ethers.BigNumber.from(amountOutMin.toString()).toHexString();

    const path = [quote.address, base.address]; //An array of token addresses
    const to = wallet.address; // should be a checksummed recipient address
    const deadlineInSecs = Math.floor(Date.now() / 1000) + 60 * 5; // 20 minutes from the current Unix time
    const value = trade.inputAmount.raw; // // needs to be converted to e.g. hex
    const valueHex = ethers.BigNumber.from(value.toString()).toHexString(); //convert to hex string

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
    const sendTxnPromise = wallet.sendTransaction(rawTxn);

    //Resolves to the TransactionReceipt once the transaction has been included in the chain for x confirms blocks.
    const receipt = await sendTxnPromise.wait();
    const sendTxn = await sendTxnPromise;

    //Logs the information about the transaction it has been mined.
    if (receipt) {
      console.log(
        ' - Transaction is mined - ' +
          '\n' +
          'Transaction Hash:' +
          sendTxn.hash +
          '\n' +
          'Block Number: ' +
          receipt.blockNumber +
          '\n' +
          'Navigate to https://rinkeby.etherscan.io/txn/' +
          sendTxn.hash,
        'to see your transaction',
      );
    } else {
      console.log('Error submitting transaction');
    }
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

  getAppProvider() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    return this.ethersServer.getProvider(rpcUrl);
  }

  getAppWallet() {
    const privateKey = this.configService.get<string>('WALLET_PK');
    return this.ethersServer.getWallet(privateKey, this.provider);
  }
}
