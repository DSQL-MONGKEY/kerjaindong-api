import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../common/decorators';
import {
  CompanyAccessGuard,
  CompanyContext,
} from '../../common/guards/company-access.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { FindCompanyJobsQueryDto } from './dto/find-company-jobs-query.dto';
import { JobsService } from './jobs.service';

@UseGuards(CompanyAccessGuard)
@Controller('companies/:companyId/jobs')
export class CompanyJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@CurrentCompany() company: CompanyContext, @Body() dto: CreateJobDto) {
    return this.jobsService.create(company.companyId, dto);
  }

  @Get()
  findAll(
    @CurrentCompany() company: CompanyContext,
    @Query() query: FindCompanyJobsQueryDto,
  ) {
    return this.jobsService.findByCompany(company.companyId, query);
  }
}
