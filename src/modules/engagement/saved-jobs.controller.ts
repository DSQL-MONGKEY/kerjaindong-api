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
export class SavedJobsController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('jobs/:jobId/save')
  @HttpCode(HttpStatus.OK)
  save(
    @GetCurrentUserId() userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.engagementService.saveJob(userId, jobId);
  }

  @Delete('jobs/:jobId/save')
  @HttpCode(HttpStatus.OK)
  unsave(
    @GetCurrentUserId() userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.engagementService.unsaveJob(userId, jobId);
  }

  @Get('saved-jobs')
  findMine(
    @GetCurrentUserId() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.engagementService.findSavedJobs(userId, query);
  }
}
