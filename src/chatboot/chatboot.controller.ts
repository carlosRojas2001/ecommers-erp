import { Controller, Post, Body } from '@nestjs/common';
import { ChatbootService } from './chatboot.service';

@Controller('chatboot')
export class ChatbootController {
  constructor(private readonly chatbootService: ChatbootService) {}

  @Post()
  async chat(
    @Body('message')
    message: string
  ) {
    return this.chatbootService.chat(message);
  }

}
