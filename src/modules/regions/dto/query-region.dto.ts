import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RegionLevel } from '../../../generated/enums';

export class QueryRegionDto {
  @IsOptional()
  @IsEnum(RegionLevel)
  level?: RegionLevel;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}
