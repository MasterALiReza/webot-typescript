import Redis from 'ioredis';
import { config } from '../../shared/config';
import { logger } from '../../shared/logger';

class RedisConnection {
    private static instance: Redis | null = null;

    static getConnection(): Redis {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new Redis({
                host: config.REDIS_HOST,
                port: config.REDIS_PORT,
                password: config.REDIS_PASSWORD,
                maxRetriesPerRequest: null, // Required for BullMQ
                enableReadyCheck: false, // BullMQ recommendation
                retryStrategy: (times: number) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            });

            RedisConnection.instance.on('connect', () => {
                logger.info('Redis connected successfully');
            });

            RedisConnection.instance.on('error', (error) => {
                logger.error('Redis connection error:', error);
            });

            RedisConnection.instance.on('close', () => {
                logger.warn('Redis connection closed');
            });

            RedisConnection.instance.on('reconnecting', () => {
                logger.info('Redis reconnecting...');
            });
        }

        return RedisConnection.instance;
    }

    static async disconnect(): Promise<void> {
        if (RedisConnection.instance) {
            await RedisConnection.instance.quit();
            RedisConnection.instance = null;
            logger.info('Redis disconnected');
        }
    }

    static async healthCheck(): Promise<boolean> {
        try {
            const connection = RedisConnection.getConnection();
            const result = await connection.ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('Redis health check failed:', error);
            return false;
        }
    }
}

export const redisConnection = RedisConnection.getConnection();
export { RedisConnection };
