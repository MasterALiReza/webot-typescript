import { Worker, Job } from 'bullmq';
import { redisConnection } from '../RedisConnection';
import { prisma } from '../../database/prisma';
import { PanelFactory } from '../../panels/PanelFactory';
import { logger } from '../../../shared/logger';
import { config } from '../../../shared/config';
import { Bot } from 'grammy';

export interface TestConfigCleanupJobData {
    batchSize?: number;
}

/**
 * TestConfigCleanupWorker - Removes expired test/trial accounts
 * Deletes test accounts after duration expires
 * Based on configtest.php from original project
 */
export class TestConfigCleanupWorker {
    private worker: Worker;
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;

        this.worker = new Worker(
            'test-config-cleanup',
            async (job: Job<TestConfigCleanupJobData>) => {
                return await this.processJob(job);
            },
            {
                connection: redisConnection,
                concurrency: 3,
                limiter: {
                    max: 5,
                    duration: 60000,
                },
            }
        );

        this.worker.on('completed', (job) => {
            logger.info(`Test config cleanup job ${job.id} completed`);
        });

        this.worker.on('failed', (job, error) => {
            logger.error(`Test config cleanup job ${job?.id} failed:`, error);
        });

        logger.info('TestConfigCleanupWorker initialized');
    }

    private async processJob(job: Job<TestConfigCleanupJobData>): Promise<{ processed: number; removed: number }> {
        const batchSize = job.data.batchSize || 10;
        const durationHours = config.TEST_ACCOUNT_DURATION_HOURS;

        logger.info(`Processing test config cleanup (batch size: ${batchSize}, duration: ${durationHours}h)`);

        // Get active test accounts
        const testInvoices = await prisma.invoice.findMany({
            where: {
                status: 'ACTIVE',
                product: {
                    name: 'usertest',
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

        for (const invoice of testInvoices) {
            try {
                const wasRemoved = await this.checkAndRemoveTestAccount(invoice, durationHours);
                if (wasRemoved) removed++;
                processed++;
            } catch (error) {
                logger.error(`Error processing test invoice ${invoice.id}:`, error);
            }
        }

        return { processed, removed };
    }

    private async checkAndRemoveTestAccount(invoice: any, _durationHours: number): Promise<boolean> {
        // Get panel adapter
        const adapter = PanelFactory.create(invoice.panel);

        // Get user info from panel
        const panelUser = await adapter.getUser(invoice.username);

        if (!panelUser) {
            return false;
        }

        // Check if test account is not active, on_hold, disabled, or unsuccessful
        if (!['active', 'on_hold', 'Unsuccessful', 'disabled'].includes(panelUser.status)) {
            try {
                // Remove from panel
                await adapter.removeUser(invoice.username);

                // Update invoice status
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: 'DISABLED' },
                });

                // Notify user about test expiration
                const message = this.formatExpirationMessage(invoice.username);

                try {
                    await this.bot.api.sendMessage(
                        invoice.userId,
                        message,
                        {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [[
                                    {
                                        text: '🛒 خرید سرویس',
                                        callback_data: 'buy',
                                    },
                                ]],
                            },
                        }
                    );
                } catch (notifyError) {
                    logger.warn(`Failed to notify user ${invoice.userId} about test expiration:`, notifyError);
                }

                logger.info(`Removed test account ${invoice.username} (user: ${invoice.userId})`);
                return true;
            } catch (error) {
                logger.error(`Failed to remove test account ${invoice.username}:`, error);
                return false;
            }
        }

        return false;
    }

    private formatExpirationMessage(username: string): string {
        return `
⏰ <b>اتمام سرویس تست</b>

نام کاربری: <code>${username}</code>

سرویس آزمایشی شما به پایان رسید و از سیستم حذف شد.

برای استفاده از سرویس کامل، از منوی زیر اقدام به خرید کنید.
        `.trim();
    }

    async close(): Promise<void> {
        await this.worker.close();
        logger.info('TestConfigCleanupWorker closed');
    }
}
