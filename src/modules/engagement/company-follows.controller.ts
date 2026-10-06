import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { GetCurrentUserId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { EngagementService } from './engagement.service';

@Controller()
export class CompanyFollowsController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('companies/:companyId/follow')
  @HttpCode(HttpStatus.OK)
  follow(
    @GetCurrentUserId() userId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.engagementService.followCompany(userId, companyId);
  }

  @Delete('companies/:companyId/follow')
  @HttpCode(HttpStatus.OK)
  unfollow(
    @GetCurrentUserId() userId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.engagementService.unfollowCompany(userId, companyId);
  }

  @Get('followed-companies')
  findMine(
    @GetCurrentUserId() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.engagementService.findFollowedCompanies(userId, query);
  }
}
