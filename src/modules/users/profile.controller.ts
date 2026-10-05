import { Body, Controller, Get, Patch } from '@nestjs/common';
import { GetCurrentUserId } from '../../common/decorators';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@Controller('users')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@GetCurrentUserId() userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  updateMe(@GetCurrentUserId() userId: string, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(userId, dto);
  }
}
