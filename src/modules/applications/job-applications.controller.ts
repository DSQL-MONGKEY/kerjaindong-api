import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetCurrentUserId } from '../../common/decorators';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { FindApplicationsQueryDto } from './dto/find-applications-query.dto';

@Controller('jobs/:jobId/applications')
export class JobApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  apply(
    @GetCurrentUserId() userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.apply(userId, jobId, dto);
  }

  @UseGuards(CompanyAccessGuard)
  @Get()
  findByJob(
    @GetCurrentUserId() userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query() query: FindApplicationsQueryDto,
  ) {
    return this.applicationsService.findByJob(userId, jobId, query);
  }
}
