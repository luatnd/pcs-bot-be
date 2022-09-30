import { Module } from '@nestjs/common';
import { WSService } from './socket-client.service';

@Module({
  providers: [WSService],
})
export class SocketClientModule {}
