import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { VerificationStatus } from '../../../generated/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAdminCompaniesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(VerificationStatus)
  verification?: VerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
