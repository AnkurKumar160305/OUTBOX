import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

export const redisConfig = redisUrl
  ? {
      connectionString: redisUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    };

export const redisConnection = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : new Redis(redisConfig as any);

redisConnection.on('connect', () => {
  console.log('✅ Redis client connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});
