import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { GetCurrentUserId } from '../../common/decorators';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { ResumesService } from './resumes.service';

@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  create(@GetCurrentUserId() userId: string, @Body() dto: CreateResumeDto) {
    return this.resumesService.create(userId, dto);
  }

  @Get()
  findMine(@GetCurrentUserId() userId: string) {
    return this.resumesService.findMine(userId);
  }

  @Get(':id')
  getMine(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resumesService.getMine(userId, id);
  }

  @Patch(':id')
  updateMine(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResumeDto,
  ) {
    return this.resumesService.updateMine(userId, id, dto);
  }

  @Delete(':id')
  removeMine(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resumesService.removeMine(userId, id);
  }

  @Post(':id/primary')
  @HttpCode(HttpStatus.OK)
  setPrimary(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resumesService.setPrimary(userId, id);
  }
}
