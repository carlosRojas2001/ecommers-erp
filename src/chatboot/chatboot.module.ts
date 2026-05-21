import { Module } from '@nestjs/common';
import { ChatbootService } from './chatboot.service';
import { ChatbootController } from './chatboot.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChatbootController],
  providers: [ChatbootService],
})
export class ChatbootModule { }
