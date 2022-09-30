// socket-client.ts
import { Injectable } from '@nestjs/common';
import * as WebSocket from 'ws';
import { clearTimeout } from 'timers';

type WsServiceOption = {
  onConnected: () => void;
  // eslint-disable-next-line no-unused-vars
  onMessage: (message: any) => void;
  onClose?: () => void;
  ping?: () => void;
  pingInterval?: number;
  logger?: any;
};

@Injectable()
export class WSService {
  // wss://echo.websocket.org is a test websocket server
  public ws: WebSocket;

  private closeTimeout: NodeJS.Timeout;
  private pingTimeout: NodeJS.Timeout;
  private logger = console;
  private url: string;
  private opt;

  constructor(url: string, opt: WsServiceOption) {
    this.url = url;
    this.opt = opt;
    if (opt.logger) {
      this.logger = opt.logger;
    }

    this.init();
  }

  init() {
    const url = this.url;
    const opt = this.opt;

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.logger.debug('{WSService.init} open');
      this.heartbeat();
      this.onConnected();
      opt.onConnected && opt.onConnected();
    });

    this.ws.on('ping', () => {
      this.logger.debug('{WSService.init} ping');
      this.heartbeat();
    });

    this.ws.on('pong', () => {
      this.logger.debug('{WSService.init} pong');
      this.heartbeat();
    });

    this.ws.on('message', (message: MessageEvent) => {
      this.heartbeat();
      this.onMessage(message);
    });

    this.ws.on('error', (message) => {
      this.logger.debug('{WSService.init} error');
      this.ws.close();
      clearTimeout(this.closeTimeout);
    });

    this.ws.on('close', (ev) => {
      this.logger.debug('{WSService.init} close');
      this.opt.onClose && this.opt.onClose();
      // delay 10s then reconnect
      setTimeout(() => {
        this.reConnect();
      }, 15000);
    });

    // this.logger.log('{init} this.ws: ', this.ws);
  }

  reConnect() {
    this.logger.warn('{WSService.reConnect} readyState: ', this.ws.readyState);
    this.init();
  }

  heartbeat() {
    this.refreshPingPong();

    // Use `WebSocket#terminate()`, which immediately destroys the connection,
    // instead of `WebSocket#close()`, which waits for the close timer.
    // Delay should be equal to the interval at which your server
    // sends out pings plus a conservative assumption of the latency.
    clearTimeout(this.closeTimeout);
    this.closeTimeout = setTimeout(() => {
      // this.ws.terminate();
      this.ws.close();
    }, 60000 + 1000);
  }

  refreshPingPong() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      this.opt.ping();
    }, 10000);
  }

  isReady() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  onConnected() {
    this.logger.log('{WSService} opened');
  }

  /**
   * @param data
   * @throws Error
   */
  send(data: any) {
    if (this.isReady()) {
      return this.ws.send(data);
    } else {
      throw new Error("Connection haven't ready, plz try again");
    }
  }

  /**
   * @param data
   * @throws Error
   */
  sendObject(data: any) {
    return this.send(JSON.stringify(data));
  }

  onMessage(message: any) {
    this.logger.log('{WSService.onMessage} message: ', message);
    this.opt.onMessage && this.opt.onMessage(message);
  }
}
