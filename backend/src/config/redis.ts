import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

export const redisConnection = new Redis(redisConfig);

redisConnection.on('connect', () => {
  console.log('✅ Redis client connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});
