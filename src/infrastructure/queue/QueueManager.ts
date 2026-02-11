import { Queue, QueueOptions, Job } from 'bullmq';
import { redisConnection } from './RedisConnection';
import { logger } from '../../shared/logger';

export type JobType =
    | 'expiry-warning'
    | 'volume-warning'
    | 'card-payment-verify'
    | 'expired-service-cleanup'
    | 'test-config-cleanup'
    | 'broadcast';

export interface JobData {
    [key: string]: any;
}

const queueOptions: QueueOptions = {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 7 * 24 * 60 * 60, // Keep completed jobs for 7 days
            count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
            age: 30 * 24 * 60 * 60, // Keep failed jobs for 30 days
        },
    },
};

export class QueueManager {
    private static queues: Map<JobType, Queue> = new Map();

    static getQueue(jobType: JobType): Queue {
        if (!this.queues.has(jobType)) {
            const queue = new Queue(jobType, queueOptions);
            this.queues.set(jobType, queue);

            // Log queue events
            queue.on('error', (error) => {
                logger.error(`Queue ${jobType} error:`, error);
            });

            queue.on('waiting', (jobId) => {
                logger.debug(`Job ${jobId} waiting in queue ${jobType}`);
            });
        }

        return this.queues.get(jobType)!;
    }

    /**
     * Add a job to a queue
     */
    static async addJob(
        jobType: JobType,
        data: JobData,
        options?: {
            delay?: number;
            priority?: number;
            jobId?: string;
        }
    ): Promise<Job> {
        const queue = this.getQueue(jobType);
        const job = await queue.add(jobType, data, options);
        logger.info(`Job ${job.id} added to queue ${jobType}`);
        return job;
    }

    /**
     * Schedule a recurring job
     */
    static async scheduleRecurringJob(
        jobType: JobType,
        cronExpression: string,
        data: JobData = {}
    ): Promise<void> {
        const queue = this.getQueue(jobType);

        // Remove existing repeatable jobs for this type
        const repeatableJobs = await queue.getRepeatableJobs();
        for (const job of repeatableJobs) {
            if (job.name === jobType) {
                await queue.removeRepeatableByKey(job.key);
            }
        }

        // Add new repeatable job
        await queue.add(jobType, data, {
            repeat: {
                pattern: cronExpression,
            },
            jobId: `${jobType}-recurring`,
        });

        logger.info(`Scheduled recurring job ${jobType} with cron: ${cronExpression}`);
    }

    /**
     * Get queue statistics
     */
    static async getQueueStats(jobType: JobType) {
        const queue = this.getQueue(jobType);
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
        };
    }

    /**
     * Pause a queue
     */
    static async pauseQueue(jobType: JobType): Promise<void> {
        const queue = this.getQueue(jobType);
        await queue.pause();
        logger.info(`Queue ${jobType} paused`);
    }

    /**
     * Resume a queue
     */
    static async resumeQueue(jobType: JobType): Promise<void> {
        const queue = this.getQueue(jobType);
        await queue.resume();
        logger.info(`Queue ${jobType} resumed`);
    }

    /**
     * Clean all queues (remove completed/failed jobs)
     */
    static async cleanAllQueues(): Promise<void> {
        for (const [jobType, queue] of this.queues) {
            await queue.clean(7 * 24 * 60 * 60 * 1000, 100, 'completed');
            await queue.clean(30 * 24 * 60 * 60 * 1000, 100, 'failed');
            logger.info(`Cleaned queue ${jobType}`);
        }
    }

    /**
     * Close all queues (graceful shutdown)
     */
    static async closeAll(): Promise<void> {
        for (const [jobType, queue] of this.queues) {
            await queue.close();
            logger.info(`Closed queue ${jobType}`);
        }
        this.queues.clear();
    }
}
