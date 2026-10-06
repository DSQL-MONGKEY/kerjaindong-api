import { Module } from '@nestjs/common';
import { CompanyAccessService } from './company-access.service';
import { CompanyInvitationsController } from './company-invitations.controller';
import { InvitationsController } from './invitations.controller';
import { MembersController } from './members.controller';

/**
 * Bounded context akses perusahaan: keanggotaan (member internal), role
 * perusahaan, dan undangan. Terpisah dari module `companies` (profil
 * perusahaan) karena lifecycle aturan dan route-nya berbeda — sebagian route
 * bahkan tidak ber-prefix `/companies` (lihat `invitations.controller.ts`).
 */
@Module({
  controllers: [
    MembersController,
    CompanyInvitationsController,
    InvitationsController,
  ],
  providers: [CompanyAccessService],
})
export class CompanyAccessModule {}
