import { PartialType } from '@nestjs/mapped-types';
import { CreateSeekerProfileDto } from './create-seeker-profile.dto';

export class UpdateSeekerProfileDto extends PartialType(
  CreateSeekerProfileDto,
) {}
