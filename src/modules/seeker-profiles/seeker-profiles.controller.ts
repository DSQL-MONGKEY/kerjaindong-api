import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { GetCurrentUserId } from '../../common/decorators';
import { CreateSeekerProfileDto } from './dto/create-seeker-profile.dto';
import { UpdateSeekerProfileDto } from './dto/update-seeker-profile.dto';
import { SeekerProfilesService } from './seeker-profiles.service';

@Controller('seeker-profile')
export class SeekerProfilesController {
  constructor(private readonly seekerProfilesService: SeekerProfilesService) {}

  @Post()
  create(
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateSeekerProfileDto,
  ) {
    return this.seekerProfilesService.create(userId, dto);
  }

  @Get('me')
  getMine(@GetCurrentUserId() userId: string) {
    return this.seekerProfilesService.getMine(userId);
  }

  @Patch('me')
  updateMine(
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdateSeekerProfileDto,
  ) {
    return this.seekerProfilesService.updateMine(userId, dto);
  }
}
