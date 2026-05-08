import { Module } from '@nestjs/common';
import { HeroSliderService } from './hero-slider.service';
import { HeroSliderController } from './hero-slider.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HeroSliderController],
  providers: [HeroSliderService],
})
export class HeroSliderModule {}
