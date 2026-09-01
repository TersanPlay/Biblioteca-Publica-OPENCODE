import 'dotenv/config';
import { users } from '../src/lib/appwrite';
import { findDocBy, createDoc, getDoc, COLLECTIONS } from '../src/lib/store';

async function main() {
  // 1. Configuração inicial (Setting único) — estrutura, sem dados demonstrativos
  const existingSettings = await getDoc(COLLECTIONS.settings, 'singleton');
  if (!existingSettings) {
    await createDoc(
      COLLECTIONS.settings,
      {
        loanLimit: 4,
        defaultLoanDays: 15,
        maxRenewals: 1,
        libraryName: '',
        libraryAddress: null,
        libraryPhone: null,
        libraryEmail: null,
        libraryHours: null,
      },
      'singleton',
    );
    console.log('Configuração inicial criada (structure).');
  }

  // 2. Primeiro administrador via env (sem credenciais padrão)
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || 'Administrador';

  if (adminEmail && adminPassword) {
    const existing = await findDocBy(COLLECTIONS.users, 'role', 'ADMIN');
    if (!existing) {
      let awUser;
      try {
        awUser = await users.create(
          `user-${Date.now()}`,
          adminEmail,
          undefined,
          adminPassword,
          adminName,
        );
      } catch (err: any) {
        if (err?.type === 'user_already_exists') {
          console.log('Email do admin já existe no Appwrite Auth. Crie o registro em users se preciso.');
          return;
        }
        throw err;
      }
      await createDoc(COLLECTIONS.users, {
        appwriteUserId: awUser.$id,
        name: adminName,
        email: adminEmail,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      console.log(`Administrador inicial criado no Appwrite Auth: ${adminEmail}`);
    } else {
      console.log('Administrador já existe. Nada a fazer.');
    }
  } else {
    console.log(
      'Nenhum administrador criado: defina ADMIN_EMAIL/ADMIN_PASSWORD no .env para o primeiro acesso.',
    );
  }

  console.log('Seed Appwrite concluído: apenas configuração estrutural (sem dados demonstrativos).');
}

main().catch((err) => {
  console.error('Erro no seed Appwrite:', err);
  process.exit(1);
});
