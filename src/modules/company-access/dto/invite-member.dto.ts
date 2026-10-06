import { Transform } from 'class-transformer';
import { IsEmail, IsIn, MaxLength } from 'class-validator';
import type { CompanyMemberRole } from '../../../generated/enums';

export class InviteMemberDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255)
  email!: string;

  @IsIn(['ADMIN', 'RECRUITER'], {
    message: 'Role undangan harus ADMIN atau RECRUITER',
  })
  role!: CompanyMemberRole;
}
