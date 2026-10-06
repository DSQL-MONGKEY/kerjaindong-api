import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetCurrentUserId } from '../../common/decorators';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { ApplicationsService } from './applications.service';
import { FindApplicationsQueryDto } from './dto/find-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Route statis `me` harus di atas `:id`.
  @Get('me')
  findMine(
    @GetCurrentUserId() userId: string,
    @Query() query: FindApplicationsQueryDto,
  ) {
    return this.applicationsService.findMine(userId, query);
  }

  @Get(':id')
  getOne(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getByIdForUser(userId, id);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.withdraw(userId, id);
  }

  @UseGuards(CompanyAccessGuard)
  @Patch(':id/status')
  updateStatus(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateStatus(userId, id, dto);
  }
}
