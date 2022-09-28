import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [PrismaModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
