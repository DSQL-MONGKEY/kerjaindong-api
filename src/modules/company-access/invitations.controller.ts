import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { GetCurrentUserId, Public } from '../../common/decorators';
import { CompanyAccessService } from './company-access.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

/**
 * Route undangan tidak memakai prefix `/companies` — contoh nyata bahwa
 * pengelompokan module mengikuti kapabilitas, bukan URL.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly companyAccessService: CompanyAccessService) {}

  @Public()
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.companyAccessService.previewInvitation(token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(@GetCurrentUserId() userId: string, @Body() dto: AcceptInvitationDto) {
    return this.companyAccessService.acceptInvitation(userId, dto);
  }
}
