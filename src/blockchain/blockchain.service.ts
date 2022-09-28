/* eslint-disable no-unused-vars */
import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { Chain } from '@prisma/client';
import { Cache } from 'cache-manager';
import { ethers } from 'ethers';
import { LogDescription } from 'ethers/lib/utils';
import { PrismaService } from '../prisma/prisma.service';
import { MathHelper } from '../utils/math.helper';
import { Erc20 } from './_utils/erc20';
import { ETH, EvmEvent } from './_utils/eth';
import { AppError } from '../../libs/errors/base.error';

// type EvmChain = {
//   chain_id: 1,
//   rpc_url: '',
//   symbol: 'ETH',
//   name: '',
//   icon: '',
//   explorer: '',
// }

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  constructor(private prisma: PrismaService, @Inject(CACHE_MANAGER) private cache: Cache) {}

  async getBalance(address: string, chain: Chain): Promise<number> {
    const result = await Erc20.balanceOf(chain, address, address);
    return MathHelper.div(result, 1e18).toNumber();
    // switch (chain.name.toLowerCase()) {
    //   case 'eth':
    //   case 'bsc':
    //     const result = await Erc20.balanceOf(chain, address, address);
    //     const balance = MathHelper.div(result, 1e18).toNumber();
    //     return balance;
    //   default:
    //     throw new Error('UNSUPPORTED_CHAIN');
    // }
  }

  async getTransaction(txHash: string, chain: Chain) {
    return await Erc20.transaction(chain, txHash);
    // switch (chain.name.toLowerCase()) {
    //   case 'eth':
    //   case 'bsc':
    //     const result = await Erc20.transaction(chain, txHash);
    //     // console.log('result: ', result);
    //     return result;
    //   default:
    //     throw new Error('UNSUPPORTED_CHAIN');
    // }
  }

  async getDecimals(chain: Chain, contractAddress: string) {
    return Erc20.getDecimals(chain, contractAddress);
  }

  async getLastestBlock(chain: Chain) {
    return await ETH.lastBlock(chain);
    // switch (chain.name.toLowerCase()) {
    //   case 'bsc':
    //   case 'eth':
    //     const lastestBlock = await ETH.lastBlock(chain);
    //
    //     // console.log('result: ', result);
    //     return lastestBlock;
    //   default:
    //     throw new AppError(`${chain.name} was not supported`, 'UNSUPPORTED_CHAIN');
    // }
  }

  async getBlockInfo(chain: Chain, block: number) {
    return await ETH.getBlock(chain, block);
    // switch (chain.name.toLowerCase()) {
    //   case 'bsc':
    //   case 'eth':
    //     const blockInfo = await ETH.getBlock(chain, block);
    //     // console.log('result: ', result);
    //     return blockInfo;
    //   default:
    //     throw new AppError(`${chain.name} was not supported`, 'UNSUPPORTED_CHAIN');
    // }
  }

  async filterEventsFromRange(fromBlock: number, toBlock: number, chain: Chain, address?: string, events?: string[]) {
    return await ETH.getLogs(chain, fromBlock, toBlock, address, events);
    // switch (chain.name.toLowerCase()) {
    //   case 'bsc':
    //   case 'eth':
    //     const prizeEvents = await ETH.getLogs(chain, fromBlock, toBlock, address, events);
    //     // console.log('result: ', result);
    //     return prizeEvents;
    //   default:
    //     throw new AppError(`${chain.name} was not supported`, 'UNSUPPORTED_CHAIN');
    // }
  }

  async filterEvents(block: number, chain: Chain, address?: string, events?: string[]) {
    return await ETH.getLogs(chain, block, block, address, events);
    // switch (chain.name.toLowerCase()) {
    //   case 'bsc':
    //   case 'eth':
    //     const prizeEvents = await ETH.getLogs(chain, block, block, address, events);
    //     // console.log('result: ', result);
    //     return prizeEvents;
    //   default:
    //     throw new Error('UNSUPPORTED_CONTRACT');
    // }
  }

  parse721MintEvent(event: EvmEvent): LogDescription {
    const iface = new ethers.utils.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    ]);
    return iface.parseLog(event);
  }

  parse1155MintSingleEvent(event: EvmEvent) {
    const iface = new ethers.utils.Interface([
      // eslint-disable-next-line max-len
      'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
    ]);
    return iface.parseLog(event);
  }

  parse1155MintMultipleEvent(event: EvmEvent) {
    const iface = new ethers.utils.Interface([
      // eslint-disable-next-line max-len
      'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
    ]);
    return iface.parseLog(event);
  }
}
