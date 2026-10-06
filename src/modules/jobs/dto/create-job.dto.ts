import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EmploymentType,
  ExperienceLevel,
  SalaryPeriod,
  WorkMode,
} from '../../../generated/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateJobDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  requirements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  benefits?: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  salaryCurrency?: string;

  @IsOptional()
  @IsEnum(SalaryPeriod)
  salaryPeriod?: SalaryPeriod;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
