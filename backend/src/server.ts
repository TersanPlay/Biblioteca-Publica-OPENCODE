import 'dotenv/config';
import { app } from './app';
import { startBackupCrons } from './modules/backup.routes';

const port = Number(process.env.PORT || 3333);

if (!process.env.JWT_SECRET) {
  console.error('[fatal] JWT_SECRET ausente — defina no arquivo .env');
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`API da Livraria Pública rodando em http://localhost:${port}/api`);
  startBackupCrons();
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[fatal] Porta ${port} já está em uso. Encerre o processo anterior ou altere PORT no .env.`);
    process.exit(1);
  }
  console.error('[fatal] Erro ao iniciar o servidor:', err);
  process.exit(1);
});