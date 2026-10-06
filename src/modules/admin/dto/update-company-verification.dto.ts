import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { VerificationStatus } from '../../../generated/enums';

export class UpdateCompanyVerificationDto {
  @IsIn(['PENDING', 'VERIFIED', 'REJECTED'], {
    message: 'Status verifikasi harus PENDING, VERIFIED, atau REJECTED',
  })
  status!: VerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
