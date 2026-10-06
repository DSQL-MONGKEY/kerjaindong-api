import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CompanyRoles,
  GetCurrentUserId,
  Public,
} from '../../common/decorators';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@GetCurrentUserId() userId: string, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(userId, dto);
  }

  // Route statis `me` harus di atas `:slug` agar tidak ikut tertangkap.
  // Sengaja TANPA CompanyAccessGuard: user yang belum punya company harus
  // menerima 404 dari service (state "belum onboarding"), bukan 403.
  @Get('me')
  getMine(@GetCurrentUserId() userId: string) {
    return this.companiesService.getMine(userId);
  }

  @UseGuards(CompanyAccessGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @Patch('me')
  updateMine(
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateMine(userId, dto);
  }

  @Public()
  @Get(':slug')
  getPublic(@Param('slug') slug: string) {
    return this.companiesService.getPublicBySlug(slug);
  }
}
