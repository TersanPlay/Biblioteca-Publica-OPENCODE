import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      loanLimit: 4,
      defaultLoanDays: 15,
      maxRenewals: 1,
      libraryName: '',
      libraryAddress: null,
      libraryPhone: null,
      libraryEmail: null,
      libraryHours: null,
    },
  });

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || 'Administrador';

  if (adminEmail && adminPassword) {
    const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!existing) {
      await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 10),
          role: 'ADMIN',
        },
      });
      console.log(`Administrador inicial criado: ${adminEmail}`);
    }
  } else {
    console.log(
      'Nenhum administrador criado: defina ADMIN_EMAIL/ADMIN_PASSWORD no .env para o primeiro acesso.',
    );
  }

  console.log('Seed concluído: apenas configuração estrutural (sem dados demonstrativos).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
