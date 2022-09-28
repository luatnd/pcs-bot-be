/* eslint-disable no-unused-vars */
import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    if (process.env.DEBUG) {
      super({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
        errorFormat: 'colorless',
      });
      this.enableQueryLogger();
    } else {
      super();
    }
  }

  async onModuleInit() {
    await this.$connect();
    // this.shimDataType();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async enableShutdownHooks(app: INestApplication) {
    // this.$on('beforeExit', async () => {
    //   await app.close();
    // });
  }

  async enableQueryLogger() {
    this.$on('beforeExit', (event: any) => {
      Logger.log(
        '\nQuery: ' + event.query + '\n**** Params: ' + event.params + '\n**** Duration: ' + event.duration + 'ms',
      );
    });
  }

  // shimDataType() {
  //   // @ts-ignore
  //   BigInt.prototype.toJSON = function () {
  //     return this.toString();
  //   };
  // }
}
