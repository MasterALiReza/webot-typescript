import { QueueManager } from './QueueManager';
import { ExpiryWarningWorker } from './workers/ExpiryWarningWorker';
import { VolumeWarningWorker } from './workers/VolumeWarningWorker';
import { ExpiredServiceCleanupWorker } from './workers/ExpiredServiceCleanupWorker';
import { CardPaymentVerifyWorker } from './workers/CardPaymentVerifyWorker';
import { TestConfigCleanupWorker } from './workers/TestConfigCleanupWorker';
import { BroadcastWorker } from './workers/BroadcastWorker';
import { logger } from '../../shared/logger';
import { Bot } from 'grammy';

interface Workers {
    expiryWarning?: ExpiryWarningWorker;
    volumeWarning?: VolumeWarningWorker;
    expiredServiceCleanup?: ExpiredServiceCleanupWorker;
    cardPaymentVerify?: CardPaymentVerifyWorker;
    testConfigCleanup?: TestConfigCleanupWorker;
    broadcast?: BroadcastWorker;
}

let workers: Workers = {};

/**
 * Initialize all job queues and workers
 */
export async function initializeJobs(bot: Bot): Promise<void> {
    logger.info('Initializing BullMQ job system...');

    try {
        // Initialize workers
        workers.expiryWarning = new ExpiryWarningWorker(bot);
        workers.volumeWarning = new VolumeWarningWorker(bot);
        workers.expiredServiceCleanup = new ExpiredServiceCleanupWorker(bot);
        workers.cardPaymentVerify = new CardPaymentVerifyWorker(bot);
        workers.testConfigCleanup = new TestConfigCleanupWorker(bot);
        workers.broadcast = new BroadcastWorker(bot);

        // Schedule recurring jobs

        // Expiry warnings - every hour
        await QueueManager.scheduleRecurringJob(
            'expiry-warning',
            '0 * * * *', // Every hour at minute 0
            { batchSize: 5 }
        );

        // Volume warnings - every 30 minutes
        await QueueManager.scheduleRecurringJob(
            'volume-warning',
            '*/30 * * * *', // Every 30 minutes
            { batchSize: 5 }
        );

        // Expired service cleanup - every 6 hours
        await QueueManager.scheduleRecurringJob(
            'expired-service-cleanup',
            '0 */6 * * *', // Every 6 hours
            { batchSize: 10 }
        );

        // Card payment verification - every 15 minutes
        await QueueManager.scheduleRecurringJob(
            'card-payment-verify',
            '*/15 * * * *', // Every 15 minutes
            { batchSize: 10 }
        );

        // Test config cleanup - daily at 3 AM
        await QueueManager.scheduleRecurringJob(
            'test-config-cleanup',
            '0 3 * * *', // Daily at 3:00 AM
            { batchSize: 10 }
        );

        // Note: Broadcast jobs are triggered on-demand, not scheduled

        logger.info('✅ BullMQ job system initialized successfully');
        logger.info('Active jobs:');
        logger.info('  - Expiry Warning: Every hour');
        logger.info('  - Volume Warning: Every 30 minutes');
        logger.info('  - Expired Service Cleanup: Every 6 hours');
        logger.info('  - Card Payment Verify: Every 15 minutes');
        logger.info('  - Test Config Cleanup: Daily at 3 AM');
        logger.info('  - Broadcast: On-demand');
    } catch (error) {
        logger.error('Failed to initialize job system:', error);
        throw error;
    }
}

/**
 * Gracefully shutdown all workers and close queues
 */
export async function shutdownJobs(): Promise<void> {
    logger.info('Shutting down BullMQ job system...');

    try {
        // Close all workers
        if (workers.expiryWarning) {
            await workers.expiryWarning.close();
        }
        if (workers.volumeWarning) {
            await workers.volumeWarning.close();
        }
        if (workers.expiredServiceCleanup) {
            await workers.expiredServiceCleanup.close();
        }
        if (workers.cardPaymentVerify) {
            await workers.cardPaymentVerify.close();
        }
        if (workers.testConfigCleanup) {
            await workers.testConfigCleanup.close();
        }
        if (workers.broadcast) {
            await workers.broadcast.close();
        }

        // Close all queues
        await QueueManager.closeAll();

        workers = {};
        logger.info('✅ BullMQ job system shut down successfully');
    } catch (error) {
        logger.error('Error shutting down job system:', error);
        throw error;
    }
}

/**
 * Get job statistics for monitoring
 */
export async function getJobStats() {
    const stats = {
        expiryWarning: await QueueManager.getQueueStats('expiry-warning'),
        volumeWarning: await QueueManager.getQueueStats('volume-warning'),
        expiredServiceCleanup: await QueueManager.getQueueStats('expired-service-cleanup'),
        cardPaymentVerify: await QueueManager.getQueueStats('card-payment-verify'),
        testConfigCleanup: await QueueManager.getQueueStats('test-config-cleanup'),
        broadcast: await QueueManager.getQueueStats('broadcast'),
    };

    return stats;
}

/**
 * Trigger a broadcast message (on-demand)
 */
export async function triggerBroadcast(
    userIds: number[],
    message: string,
    adminId?: number,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<void> {
    await QueueManager.addJob('broadcast', {
        userIds,
        message,
        parseMode,
        adminId,
    });

    logger.info(`Broadcast job queued for ${userIds.length} users`);
}
