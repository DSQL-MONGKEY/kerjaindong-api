import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AtGuard } from './common/guards/at.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthController } from './common/health/health.controller';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CompanyAccessModule } from './modules/company-access/company-access.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { RegionsModule } from './modules/regions/regions.module';
import { ResumesModule } from './modules/resumes/resumes.module';
import { SeekerProfilesModule } from './modules/seeker-profiles/seeker-profiles.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    SeekerProfilesModule,
    CompaniesModule,
    CompanyAccessModule,
    JobsModule,
    ResumesModule,
    ApplicationsModule,
    EngagementModule,
    AdminModule,
    RegionsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
