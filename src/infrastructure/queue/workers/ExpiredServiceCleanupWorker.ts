import { Worker, Job } from 'bullmq';
import { redisConnection } from '../RedisConnection';
import { prisma } from '../../database/prisma';
import { PanelFactory } from '../../panels/PanelFactory';
import { logger } from '../../../shared/logger';
import { config } from '../../../shared/config';
import { Bot } from 'grammy';

export interface ExpiredServiceCleanupJobData {
    batchSize?: number;
}

/**
 * ExpiredServiceCleanupWorker - Removes expired services from panels
 * Deletes services that have been expired for X days (configurable)
 * Based on removeexpire.php from original project
 */
export class ExpiredServiceCleanupWorker {
    private worker: Worker;
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;

        this.worker = new Worker(
            'expired-service-cleanup',
            async (job: Job<ExpiredServiceCleanupJobData>) => {
                return await this.processJob(job);
            },
            {
                connection: redisConnection,
                concurrency: 3, // Lower concurrency for cleanup tasks
                limiter: {
                    max: 5,
                    duration: 60000,
                },
            }
        );

        this.worker.on('completed', (job) => {
            logger.info(`Expired service cleanup job ${job.id} completed`);
        });

        this.worker.on('failed', (job, error) => {
            logger.error(`Expired service cleanup job ${job?.id} failed:`, error);
        });

        logger.info('ExpiredServiceCleanupWorker initialized');
    }

    private async processJob(job: Job<ExpiredServiceCleanupJobData>): Promise<{ processed: number; removed: number }> {
        const batchSize = job.data.batchSize || 10;
        const removeDaysAfterExpiry = config.REMOVE_DAYS_AFTER_EXPIRY;

        logger.info(`Processing expired service cleanup (batch size: ${batchSize}, remove after: ${removeDaysAfterExpiry} days)`);

        // Get invoices that are active, end_of_time, end_of_volume, or sendedwarn
        const invoices = await prisma.invoice.findMany({
            where: {
                status: {
                    in: ['ACTIVE', 'END_OF_TIME', 'END_OF_VOLUME', 'SENDEDWARN'],
                },
                product: {
                    name: {
                        not: 'usertest',
                    },
                },
            },
            include: {
                user: true,
                product: true,
                panel: true,
            },
            take: batchSize,
        });

        let processed = 0;
        let removed = 0;

        for (const invoice of invoices) {
            try {
                const wasRemoved = await this.checkAndRemoveInvoice(invoice, removeDaysAfterExpiry);
                if (wasRemoved) removed++;
                processed++;
            } catch (error) {
                logger.error(`Error processing invoice ${invoice.id}:`, error);
            }
        }

        return { processed, removed };
    }

    private async checkAndRemoveInvoice(invoice: any, removeDaysAfterExpiry: number): Promise<boolean> {
        // Get panel adapter
        const adapter = PanelFactory.create(invoice.panel);

        // Get user info from panel
        const panelUser = await adapter.getUser(invoice.username);

        if (!panelUser || panelUser.status === 'Unsuccessful') {
            return false;
        }

        // Only process limited or expired services
        if (!['limited', 'expired'].includes(panelUser.status)) {
            return false;
        }

        // Calculate days since expiry
        const timeUntilExpiry = panelUser.expire - Math.floor(Date.now() / 1000);
        const daysSinceExpiry = Math.floor(timeUntilExpiry / 86400);

        // Check if service should be removed (expired for more than X days)
        if (daysSinceExpiry <= -removeDaysAfterExpiry) {
            try {
                // Remove user from panel
                await adapter.removeUser(invoice.username);

                // Update invoice status
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: 'REMOVE_TIME' as any },
                });

                // Notify user
                const message = this.formatRemovalMessage(invoice.username, panelUser.status);

                try {
                    await this.bot.api.sendMessage(
                        invoice.userId,
                        message,
                        { parse_mode: 'HTML' }
                    );
                } catch (notifyError) {
                    logger.warn(`Failed to notify user ${invoice.userId} about removal:`, notifyError);
                }

                // Report to admin channel if configured
                if (config.REPORT_CHANNEL_ID) {
                    const adminMessage = `
🗑️ <b>سرویس حذف شد - Cron</b>

نام کاربری: <code>${invoice.username}</code>
وضعیت: ${panelUser.status === 'limited' ? 'محدود شده' : 'منقضی شده'}
کاربر: ${invoice.userId}
                    `.trim();

                    try {
                        await this.bot.api.sendMessage(
                            config.REPORT_CHANNEL_ID,
                            adminMessage,
                            { parse_mode: 'HTML' }
                        );
                    } catch (reportError) {
                        logger.warn('Failed to send admin report:', reportError);
                    }
                }

                logger.info(`Removed expired service ${invoice.username} (user: ${invoice.userId})`);
                return true;
            } catch (error) {
                logger.error(`Failed to remove service ${invoice.username}:`, error);
                return false;
            }
        }

        return false;
    }

    private formatRemovalMessage(username: string, status: string): string {
        const statusText = status === 'limited' ? 'محدود شده' : 'منقضی شده';

        return `
🗑️ <b>حذف سرویس</b>

نام کاربری: <code>${username}</code>
وضعیت: ${statusText}

سرویس شما به دلیل انقضا از سیستم حذف شد.
برای خرید سرویس جدید از منوی اصلی اقدام کنید.
        `.trim();
    }

    async close(): Promise<void> {
        await this.worker.close();
        logger.info('ExpiredServiceCleanupWorker closed');
    }
}
