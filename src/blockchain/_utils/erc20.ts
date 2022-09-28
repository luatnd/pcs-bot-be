import { Chain } from '@prisma/client';
import { ethers } from 'ethers';
import { MathHelper } from '../../utils/math.helper';
import { ERC_20_ABI } from './abi/erc20_abi';
import { ETH } from './eth';

const _getContract = (chain: Chain, contractAddress: string) => {
  return new ethers.Contract(contractAddress, ERC_20_ABI, ETH.getProvider(chain));
};
const _getContractSigner = (chain: Chain, contractAddress: string, privateKey: string) => {
  // A Signer from a private key
  const wallet = new ethers.Wallet(privateKey, ETH.getProvider(chain));
  return _getContract(chain, contractAddress).connect(wallet);
};

export const Erc20 = {
  transaction: async (chain: Chain, txHash: string) => {
    const txReceipt = await ETH.getProvider(chain).getTransactionReceipt(txHash);
    if (txReceipt && txReceipt.blockNumber) {
      return txReceipt;
    }
  },
  totalSupply: async (chain: Chain, contractAddress: string) => {
    return _getContract(chain, contractAddress).totalSupply();
  },
  balanceOf: async (chain: Chain, contractAddress: string, address: string) => {
    const balance = await _getContract(chain, contractAddress).balanceOf(address);
    return balance;
  },
  allowance: async (chain: Chain, contractAddress: string, owner: string, spender: string) => {
    const contract = _getContract(chain, contractAddress);

    const _decimals = await contract.decimals();
    const decimals = Math.pow(10, _decimals);
    const result = await contract.allowance(owner, spender);
    // console.log('result: ', result);
    return MathHelper.div(result.toString(), decimals).toNumber();
  },
  transfer: async (chain: Chain, contractAddress: string, recipient: string, amount: string, prvKey: string) => {
    const contractWithSigner = _getContractSigner(chain, contractAddress, prvKey);
    const tx = await contractWithSigner.transfer(recipient, amount);
    return tx.hash;
  },
  approve: async (chain: Chain, contractAddress: string, spender: string, amount: string, prvKey: string) => {
    const contractWithSigner = _getContractSigner(chain, contractAddress, prvKey);
    // const _decimals = await contractWithSigner.decimals();
    // const decimals = Math.pow(10, _decimals);
    const tx = await contractWithSigner.approve(spender, amount, {
      gasLimit: 150000,
    });
    return tx;
    // return tx.wait();
  },
  getDecimals: async (chain: Chain, contractAddress: string) => {
    const contract = _getContract(chain, contractAddress);
    const _decimals = await contract.decimals();
    const decimals = Math.pow(10, _decimals);
    return decimals;
  },

  /***
   * @param prvKey private key of admin address or minter
   *  ***/
  filterEvents: async (
    event: string,
    block: number,
    chain: Chain,
    contractAddress: string,
    prvKey: string,
  ): Promise<ethers.Event[]> => {
    const contractWithSigner = _getContractSigner(chain, contractAddress, prvKey);
    const filterFrom = contractWithSigner.filters[event]();
    const events = await contractWithSigner.queryFilter(filterFrom, block, block);
    // console.log("events: ", events);
    return events;
  },
};
