import { PrismaClient, UserRole } from '@prisma/client';
import dotenv from 'dotenv';
import { hashPassword } from '../src/utils/password';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';
  const firstName = process.env.SEED_ADMIN_FIRST_NAME ?? 'Admin';
  const lastName = process.env.SEED_ADMIN_LAST_NAME ?? 'Principal';

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true
    },
    create: {
      email,
      firstName,
      lastName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true
    }
  });

  console.log(`Usuario admin listo: ${email}`);
}

main()
  .catch((error) => {
    console.error('Error en seed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
