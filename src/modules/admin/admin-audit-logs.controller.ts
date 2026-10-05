import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators';
import { AdminService } from './admin.service';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

@Roles('SYS_ADMIN')
@Controller('admin/audit-logs')
export class AdminAuditLogsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAll(@Query() query: FindAuditLogsQueryDto) {
    return this.adminService.findAuditLogs(query);
  }
}
