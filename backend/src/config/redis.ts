import IORedis from 'ioredis';
import { env } from './env';

let redisInstance: IORedis | null = null;

export function getRedis(): IORedis {
  if (!redisInstance) {
    redisInstance = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    });

    redisInstance.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisInstance.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });
  }
  return redisInstance;
}

// Separate connection for BullMQ (BullMQ requires its own connection)
export function createBullMQConnection(): IORedis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
