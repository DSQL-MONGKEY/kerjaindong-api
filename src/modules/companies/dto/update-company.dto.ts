import { PartialType } from '@nestjs/mapped-types';
import { CompanyFieldsDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(CompanyFieldsDto) {}
