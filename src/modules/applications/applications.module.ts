import { Module } from '@nestjs/common';
import { RegionsModule } from '../regions/regions.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { JobApplicationsController } from './job-applications.controller';

@Module({
  imports: [RegionsModule],
  controllers: [ApplicationsController, JobApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
