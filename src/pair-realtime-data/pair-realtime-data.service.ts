import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PairRealtimeDataService {
  private readonly logger = new Logger(PairRealtimeDataService.name);

  constructor(private prisma: PrismaService, private eventEmitter: EventEmitter2) {}
}
