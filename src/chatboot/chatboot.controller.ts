import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatbootService } from './chatboot.service';

@Controller('chatboot')
export class ChatbootController {
  constructor(private readonly chatbootService: ChatbootService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 req/min por IP (previene abuso/costo del LLM)
  async chat(
    @Body('message')
    message: string
  ) {
    return this.chatbootService.chat(message);
  }

}
