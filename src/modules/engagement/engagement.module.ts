import { Module } from '@nestjs/common';
import { RegionsModule } from '../regions/regions.module';
import { CompanyFollowsController } from './company-follows.controller';
import { EngagementService } from './engagement.service';
import { SavedJobsController } from './saved-jobs.controller';

@Module({
  imports: [RegionsModule],
  controllers: [SavedJobsController, CompanyFollowsController],
  providers: [EngagementService],
})
export class EngagementModule {}
