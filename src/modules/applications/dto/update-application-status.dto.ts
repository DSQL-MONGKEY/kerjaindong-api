import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ApplicationStatus } from '../../../generated/enums';
import { COMPANY_SETTABLE_STATUSES } from '../application-status.util';

export class UpdateApplicationStatusDto {
  @IsIn(COMPANY_SETTABLE_STATUSES, {
    message: 'Status lamaran tidak valid untuk diubah oleh perusahaan',
  })
  status!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
