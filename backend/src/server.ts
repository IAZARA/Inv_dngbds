import { env } from './config/env';
import { prisma } from './config/prisma';
import { createApp } from './app';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Servidor escuchando en puerto ${env.port}`);
});

const shutdown = async () => {
  console.log('Cerrando servidor...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
