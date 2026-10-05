import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { toPublicUser, USER_WITH_ACCESS_INCLUDE } from './user-response';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_ACCESS_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return toPublicUser(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName },
      include: USER_WITH_ACCESS_INCLUDE,
    });

    return toPublicUser(user);
  }
}
