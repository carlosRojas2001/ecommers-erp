import { Module } from '@nestjs/common';
import { ChatbootService } from './chatboot.service';
import { ChatbootController } from './chatboot.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
// import { RedisModule } from './redis.module';
import { Chat } from './chat.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChatbootController],
  providers: [ChatbootService],
})
export class ChatbootModule { }
