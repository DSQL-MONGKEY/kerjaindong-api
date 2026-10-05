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
import { FindAdminUsersQueryDto } from './dto/find-admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Roles('SYS_ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAll(@Query() query: FindAdminUsersQueryDto) {
    return this.adminService.findUsers(query);
  }

  @Patch(':id/status')
  updateStatus(
    @GetCurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.adminService.updateUserStatus(adminId, id, dto, {
      ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
