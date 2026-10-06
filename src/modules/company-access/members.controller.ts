import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  CompanyRoles,
  CurrentCompany,
  GetCurrentUserId,
} from '../../common/decorators';
import {
  CompanyAccessGuard,
  CompanyContext,
} from '../../common/guards/company-access.guard';
import { CompanyAccessService } from './company-access.service';

@UseGuards(CompanyAccessGuard)
@Controller('companies/:companyId/members')
export class MembersController {
  constructor(private readonly companyAccessService: CompanyAccessService) {}

  @Get()
  findAll(@CurrentCompany() company: CompanyContext) {
    return this.companyAccessService.findMembers(company.companyId);
  }

  @CompanyRoles('OWNER', 'ADMIN')
  @Delete(':userId')
  remove(
    @GetCurrentUserId() actorUserId: string,
    @CurrentCompany() company: CompanyContext,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.companyAccessService.removeMember(
      actorUserId,
      company.companyId,
      targetUserId,
    );
  }
}
