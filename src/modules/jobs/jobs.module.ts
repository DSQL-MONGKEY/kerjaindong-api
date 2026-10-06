import { Module } from '@nestjs/common';
import { RegionsModule } from '../regions/regions.module';
import { CompanyJobsController } from './company-jobs.controller';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [RegionsModule],
  controllers: [JobsController, CompanyJobsController],
  providers: [JobsService],
})
export class JobsModule {}
