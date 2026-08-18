import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { TermsService } from './terms.service';
import { UpdateTermsConditionsDto } from './dto/update-terms-conditions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get()
  async findCurrent() {
    const terms = await this.termsService.findCurrent();
    return {
      title: terms.title,
      content: terms.content,
      updated_at: terms.updated_at,
    };
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Body() dto: UpdateTermsConditionsDto) {
    const terms = await this.termsService.update(dto);
    return {
      title: terms.title,
      content: terms.content,
      updated_at: terms.updated_at,
    };
  }
}
