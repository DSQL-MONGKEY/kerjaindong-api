import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type AuditRecordInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  actorUserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Ikut transaksi pemanggil agar audit tidak pernah terlewat. */
  tx?: Prisma.TransactionClient;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput) {
    const client = input.tx ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ...(input.before !== undefined
          ? { before: input.before as Prisma.InputJsonValue }
          : {}),
        ...(input.after !== undefined
          ? { after: input.after as Prisma.InputJsonValue }
          : {}),
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
}
