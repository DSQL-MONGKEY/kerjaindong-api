import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const lowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export type RegistrationRole = 'JOB_SEEKER' | 'EMPLOYER';

export class RegisterDto {
  @Transform(lowercase)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255)
  email!: string;

  @Transform(lowercase)
  @IsString()
  @Matches(/^[a-z0-9._-]{3,50}$/, {
    message:
      'Username hanya boleh huruf kecil, angka, titik, underscore, atau strip (3-50 karakter)',
  })
  username!: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @MaxLength(128, { message: 'Password maksimal 128 karakter' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password harus mengandung huruf dan angka',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsIn(['JOB_SEEKER', 'EMPLOYER'], {
    message: 'Role harus JOB_SEEKER atau EMPLOYER',
  })
  role?: RegistrationRole;
}
