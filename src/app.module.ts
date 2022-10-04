/* eslint-disable no-unused-vars */
import { CacheModule, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { PrismaModule } from './prisma/prisma.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { PairInfoModule } from './pair-info/pair-info.module';
import { NewPairTradingModule } from './new-pair-trading/new-pair-trading.module';
import { PairRealtimeDataModule } from './pair-realtime-data/pair-realtime-data.module';
import { PancakeswapV2Module } from './pancakeswap-v2/pancakeswap-v2.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true }),
    GraphQLModule.forRootAsync({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      useFactory: async (configService: ConfigService) => {
        return {
          // debug: configService.get('NODE_ENV') !== 'production',
          // playground: configService.get('NODE_ENV') === 'production',
          debug: true,
          playground: true,
          introspection: true,
          autoSchemaFile: process.cwd() + '/src/schema.gql',
          subscriptions: {
            'graphql-ws': true,
            'subscriptions-transport-ws': false,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      verboseMemoryLeak: true,
    }),
    PrismaModule,
    BlockchainModule,
    PairInfoModule,
    NewPairTradingModule,
    PairRealtimeDataModule,
    PancakeswapV2Module,
  ],
  controllers: [AppController],
  providers: [AppService, AppResolver],
})
export class AppModule {}
