import { PartialType } from '@nestjs/mapped-types';
import { CreateHeroSliderDto } from './create-hero-slider.dto';

export class UpdateHeroSliderDto extends PartialType(CreateHeroSliderDto) {}
