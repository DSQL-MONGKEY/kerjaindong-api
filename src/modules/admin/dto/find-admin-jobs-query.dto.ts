import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { JobStatus } from '../../../generated/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAdminJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
