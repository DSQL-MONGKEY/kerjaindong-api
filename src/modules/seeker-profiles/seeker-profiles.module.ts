import { Module } from '@nestjs/common';
import { RegionsModule } from '../regions/regions.module';
import { SeekerProfilesController } from './seeker-profiles.controller';
import { SeekerProfilesService } from './seeker-profiles.service';

@Module({
  imports: [RegionsModule],
  controllers: [SeekerProfilesController],
  providers: [SeekerProfilesService],
})
export class SeekerProfilesModule {}
