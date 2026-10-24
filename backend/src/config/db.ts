import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

prisma.$connect()
  .then(() => console.log('✅ PostgreSQL connected successfully via Prisma'))
  .catch((err: Error) => console.error('❌ PostgreSQL connection error:', err.message));
