import * as argon2 from 'argon2';
import { log } from './_helpers';
import { ISeeder } from './_types';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

export default class UsersSeeder implements ISeeder {
  name = 'users';

  async run(prisma) {
    const username = (process.env.SEED_ADMIN_USERNAME ?? 'superadmin')
      .trim()
      .toLowerCase();
    const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@kerjaindong.local')
      .trim()
      .toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!password) {
      log(this.name, 'SEED_ADMIN_PASSWORD kosong, lewati pembuatan SYS_ADMIN');
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing) {
      log(this.name, `user ${username} sudah ada, dilewati`);
      return;
    }

    const hashedPassword = await argon2.hash(password, ARGON2_OPTIONS);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        fullName: 'System Administrator',
      },
    });

    await prisma.userRoleAssignment.create({
      data: { userId: user.id, role: 'SYS_ADMIN' },
    });

    log(this.name, `SYS_ADMIN siap: ${username}`);
  }
}
