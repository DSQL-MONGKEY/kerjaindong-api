import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { GetCurrentUserId, Roles } from '../../common/decorators';
import { AdminService } from './admin.service';
import { FindAdminJobsQueryDto } from './dto/find-admin-jobs-query.dto';
import { UpdateJobModerationDto } from './dto/update-job-moderation.dto';

@Roles('SYS_ADMIN')
@Controller('admin/jobs')
export class AdminJobsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAll(@Query() query: FindAdminJobsQueryDto) {
    return this.adminService.findJobs(query);
  }

  @Patch(':id/status')
  updateStatus(
    @GetCurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobModerationDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.adminService.updateJobStatus(adminId, id, dto, {
      ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
