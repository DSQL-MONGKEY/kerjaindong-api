import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { JobStatus } from '../../../generated/enums';

export class UpdateJobModerationDto {
  @IsIn(['PUBLISHED', 'PAUSED', 'ARCHIVED'], {
    message: 'Status moderasi harus PUBLISHED, PAUSED, atau ARCHIVED',
  })
  status!: JobStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
