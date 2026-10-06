import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CompanyRoles, CurrentCompany, Public } from '../../common/decorators';
import {
  CompanyAccessGuard,
  CompanyContext,
} from '../../common/guards/company-access.guard';
import { FindJobsQueryDto } from './dto/find-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Public()
  @Get()
  findAll(@Query() query: FindJobsQueryDto) {
    return this.jobsService.findPublic(query);
  }

  @UseGuards(CompanyAccessGuard)
  @Get(':id/manage')
  findManaged(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
  ) {
    return this.jobsService.findManaged(id, company.companyId);
  }

  @Public()
  @Get(':slug')
  findPublic(@Param('slug') slug: string) {
    return this.jobsService.findPublicBySlug(slug);
  }

  @UseGuards(CompanyAccessGuard)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(id, company.companyId, dto);
  }

  @UseGuards(CompanyAccessGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
  ) {
    return this.jobsService.remove(id, company.companyId);
  }

  @UseGuards(CompanyAccessGuard)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
  ) {
    return this.jobsService.transition(id, company.companyId, 'publish');
  }

  @UseGuards(CompanyAccessGuard)
  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
  ) {
    return this.jobsService.transition(id, company.companyId, 'pause');
  }

  @UseGuards(CompanyAccessGuard)
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
  ) {
    return this.jobsService.transition(id, company.companyId, 'close');
  }

  @UseGuards(CompanyAccessGuard)
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() company: CompanyContext,
  ) {
    return this.jobsService.transition(id, company.companyId, 'archive');
  }
}
