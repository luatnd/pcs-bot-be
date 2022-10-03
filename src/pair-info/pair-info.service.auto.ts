import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as throttle from 'lodash.throttle';
import * as LRUCache from 'lru-cache';
import { WSService } from '../../libs/socket-client/socket-client.service';
import { AppError } from '../../libs/errors/base.error';
import { DtPair, DTResponseType } from './type/dextool';
import { PairInfoService } from './pair-info.service';

@Injectable()
export class PairInfoServiceAuto implements OnModuleInit {
  private readonly logger = new Logger(PairInfoServiceAuto.name);

  private ws: WSService;

  private subRetry = 0;
  private pairStreamStopped = true;
  private allowListen = false;

  // private pairThrottles: Record<string, any> = {};
  private pairThrottles = new LRUCache({
    max: 5,
  });

  constructor(private pairInfoService: PairInfoService) {
    const url = process.env.SOCKET_URL;
    if (!url) {
      throw new AppError('process.env.SOCKET_URL was not configured', 'InvalidEnv');
    }

    this.ws = new WSService(url, {
      onConnected: () => {
        this.logger.log('{onConnected} : ');
        this.ensurePairEventStreamAlive();
      },
      onMessage: (message: any) => {
        this.allowListen && this.filterPairEvent(message);
      },
      onClose: () => {
        this.pairStreamStopped = true;
      },
      ping: () => {
        this.ws.ws.send('ping');
      },
      pingInterval: 10000,
    });
  }

  onModuleInit() {
    this.logger.log('{onModuleInit}: Start listen');
    this.allowListen = true;
  }

  ensurePairEventStreamAlive() {
    if (this.pairStreamStopped) {
      this.subscribePairEvents();
    }
  }

  subscribePairEvents() {
    this.logger.log('{subscribePairEvents} this.ws.readyState: ', this.ws.ws.readyState);
    if (this.ws.isReady()) {
      this.logger.log('{subscribePairEvents} ready => SendObject');
      const pairSubscribeMsg = {
        jsonrpc: '2.0',
        method: 'subscribe',
        params: { chain: 'bsc', channel: 'bsc:pools' },
        id: 2,
      };
      this.ws.sendObject(pairSubscribeMsg);
    } else {
      // retry after 5s max 10 times
      if (this.subRetry <= 10) {
        this.subRetry += 1;
        setTimeout(() => {
          this.subscribePairEvents();
        }, 5000);
      }
    }
  }

  async filterPairEvent(message: any) {
    // console.log('{filterPairEvent} message: ', message);

    if (typeof message === 'string') {
      if (message === 'pong') {
        this.logger.log(message);
        return;
      }

      let msg: DTResponseType;
      try {
        msg = JSON.parse(message);
      } catch (e) {
        this.logger.error('{filterPairEvent} e, message: ', e, message);
        return;
      }

      if (msg.result.data.event === 'update' && msg.result.status === 'ok') {
        const isPairCreationEvent = 'pair' in msg.result.data;
        if (isPairCreationEvent) {
          // This is non-blocking
          this.handlePairEvent(msg.result.data.pair);
        }
      }
    }
  }

  /**
   * dextool fires update event sometime have creation sometime not,
   * @param pair
   */
  async handlePairEvent(pair: DtPair) {
    // if (pair.creation) {
    //   await this.handleLPCreation(pair);
    // }
    // await this.handleLPUpdate(pair);

    // if (pair.token0.symbol !== 'SPOOKYS') {
    //   return;
    // }

    this.logger.debug('{handlePairEvent} : ' + this.pairInfoService.getPairName(pair));
    this.updateOrCreateWithThrottle(pair);
  }

  /**
   * Update or create pair with throttler
   * It only applies for each single pair
   */
  updateOrCreateWithThrottle(p: DtPair) {
    let throttleExecutor;
    const pairUniqueId = this.pairInfoService.getPairIdFromDtPair(p);
    if (this.pairThrottles.has(pairUniqueId)) {
      // get executor
      throttleExecutor = this.pairThrottles.get(pairUniqueId);
    } else {
      // create and cache the executor
      throttleExecutor = throttle((pair) => {
        this.pairInfoService.updateOrCreatePool(pair);
      }, 1000);
      this.pairThrottles.set(pairUniqueId, throttleExecutor);
    }

    // run it
    throttleExecutor(p);
  }

  // async handleLPCreation(pair: DtPair) {
  //   // create pool
  //   this.logger.debug('{handleLPCreation} : ', this.pairInfoService.getPairName(pair));
  //   return this.pairInfoService.createPool(pair);
  // }

  // async handleLPUpdate(pair: DtPair) {
  //   // update pair price and other trading info to db
  //   this.logger.debug('{handleLPUpdate} : ', this.pairInfoService.getPairName(pair));
  //   return this.pairInfoService.updatePool();
  // }
}
