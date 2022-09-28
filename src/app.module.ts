/* eslint-disable no-unused-vars */
import { CacheModule, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BlockchainModule } from './blockchain/blockchain.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { PairInfoModule } from './pair-info/pair-info.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 5 * 60 }),
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
    CacheModule.register({ isGlobal: true, ttl: 5 * 60 }),
    ScheduleModule.forRoot(),
    PrismaModule,
    BlockchainModule,
    PairInfoModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppResolver],
})
export class AppModule {}
