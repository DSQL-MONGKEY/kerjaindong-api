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
import { FindAdminCompaniesQueryDto } from './dto/find-admin-companies-query.dto';
import { UpdateCompanyVerificationDto } from './dto/update-company-verification.dto';

@Roles('SYS_ADMIN')
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAll(@Query() query: FindAdminCompaniesQueryDto) {
    return this.adminService.findCompanies(query);
  }

  @Patch(':id/verification')
  updateVerification(
    @GetCurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyVerificationDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.adminService.updateCompanyVerification(adminId, id, dto, {
      ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
