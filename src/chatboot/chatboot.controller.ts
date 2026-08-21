import { Controller, Post, Body, Query, Get, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Chat } from './chat.service';
import { ChatbootService } from './chatboot.service';

@Controller('chatboot')
export class ChatbootController {
  constructor(
    private readonly chatService: Chat,) {}

  @Get()
  async consult(@Query('search') search:string){
    return this.chatService.filtrarTokensValidos([search])
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 req/min por IP (previene abuso/costo del LLM)
  async chat(
    @Body('message')
    message: string,
    @Req() req: Request
  ) {
    return this.chatService.buscarArticulos(message, req);
  }

}
