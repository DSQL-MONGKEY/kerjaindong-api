import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
import { InviteMemberDto } from './dto/invite-member.dto';

@UseGuards(CompanyAccessGuard)
@CompanyRoles('OWNER', 'ADMIN')
@Controller('companies/:companyId/invitations')
export class CompanyInvitationsController {
  constructor(private readonly companyAccessService: CompanyAccessService) {}

  @Post()
  create(
    @GetCurrentUserId() actorUserId: string,
    @CurrentCompany() company: CompanyContext,
    @Body() dto: InviteMemberDto,
  ) {
    return this.companyAccessService.createInvitation(
      actorUserId,
      company.companyId,
      dto,
    );
  }

  @Get()
  findAll(@CurrentCompany() company: CompanyContext) {
    return this.companyAccessService.findInvitations(company.companyId);
  }
}
