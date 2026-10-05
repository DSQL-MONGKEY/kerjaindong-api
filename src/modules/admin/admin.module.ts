import { Module } from '@nestjs/common';
import { RegionsModule } from '../regions/regions.module';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [RegionsModule],
  controllers: [
    AdminCompaniesController,
    AdminUsersController,
    AdminJobsController,
    AdminAuditLogsController,
  ],
  providers: [AdminService, AuditLogService],
  exports: [AuditLogService],
})
export class AdminModule {}
