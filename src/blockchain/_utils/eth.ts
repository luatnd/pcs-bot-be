import { Chain as EvmChain } from '@prisma/client';
import { ethers } from 'ethers';
import { randomPick } from '../../utils/Array';

type ChainName = string;
const providers: Record<ChainName, ethers.providers.JsonRpcProvider[]> = {};

export type EvmEvent = {
  topics: Array<string>;
  data: string;
};

/**
 * Get provider from provider pool to avoid rate limit
 *
 * @param chain
 */
const getProviderFromPool = (chain: EvmChain) => {
  if (!providers[chain.name] || !providers[chain.name].length) {
    providers[chain.name] = getChainProviders(chain);
  }

  // const provider = randomPick(providers[chain.name]);
  // console.log('{getProviderFromPool} provider rpc: ', provider.connection.url);

  return randomPick(providers[chain.name]);
};

const getChainProviders = (chain: EvmChain) => {
  if (!providers[chain.name]) {
    const rpcUrls = JSON.parse(chain.rpc_urls);
    if (!Array.isArray(rpcUrls)) {
      throw new Error(`rpc_urls of ${chain.name} is not an array json string`);
    }

    providers[chain.name] = rpcUrls.map(
      (rpcUrl) =>
        new ethers.providers.JsonRpcProvider(rpcUrl, {
          name: chain.name,
          chainId: chain.chain_id,
        }),
    );
  }

  return providers[chain.name];
};

export const ETH = {
  getProvider: (blockchain: EvmChain) => {
    return getProviderFromPool(blockchain);
  },
  getBlock: async (blockchain: EvmChain, block: number) => {
    return getProviderFromPool(blockchain).getBlock(block);
  },
  lastBlock: async (blockchain: EvmChain) => {
    return getProviderFromPool(blockchain).getBlockNumber();
  },
  getLogs: async (chain: EvmChain, from: number, to: number, address?: string, topics?: string[]) => {
    const req: any = {
      fromBlock: from,
      toBlock: to,
    };
    if (address) {
      req['address'] = address;
    }
    if (topics) {
      const _topics: string[] = [];
      for (const item of topics) {
        if (item.indexOf('(') >= 0) {
          _topics.push(ethers.utils.id(item));
        } else {
          _topics.push(item);
        }
      }
      req.topics = _topics;
    }
    // console.log(req)
    return getProviderFromPool(chain).getLogs(req);
  },
};
