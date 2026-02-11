import { Worker, Job } from 'bullmq';
import { redisConnection } from '../RedisConnection';
import { prisma } from '../../database/prisma';
import { PanelFactory } from '../../panels/PanelFactory';
import { logger } from '../../../shared/logger';
import { config } from '../../../shared/config';
import { Bot } from 'grammy';

export interface VolumeWarningJobData {
    batchSize?: number;
}

/**
 * VolumeWarningWorker - Monitors data usage and sends warnings
 * Alerts when usage exceeds threshold (default: < 1GB remaining)
 * Based on cronvolume.php from original project
 */
export class VolumeWarningWorker {
    private worker: Worker;
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;

        this.worker = new Worker(
            'volume-warning',
            async (job: Job<VolumeWarningJobData>) => {
                return await this.processJob(job);
            },
            {
                connection: redisConnection,
                concurrency: 5,
                limiter: {
                    max: 10,
                    duration: 60000,
                },
            }
        );

        this.worker.on('completed', (job) => {
            logger.info(`Volume warning job ${job.id} completed`);
        });

        this.worker.on('failed', (job, error) => {
            logger.error(`Volume warning job ${job?.id} failed:`, error);
        });

        logger.info('VolumeWarningWorker initialized');
    }

    private async processJob(job: Job<VolumeWarningJobData>): Promise<{ processed: number; warned: number }> {
        const batchSize = job.data.batchSize || 5;
        const thresholdGB = config.VOLUME_THRESHOLD_GB;
        const thresholdBytes = thresholdGB * Math.pow(1024, 3);

        logger.info(`Processing volume warnings (batch size: ${batchSize}, threshold: ${thresholdGB}GB)`);

        // Get active and end_of_time invoices
        const invoices = await prisma.invoice.findMany({
            where: {
                status: {
                    in: ['ACTIVE', 'END_OF_TIME'],
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
        let warned = 0;

        for (const invoice of invoices) {
            try {
                const didWarn = await this.checkAndWarnInvoice(invoice, thresholdBytes);
                if (didWarn) warned++;
                processed++;
            } catch (error) {
                logger.error(`Error processing invoice ${invoice.id}:`, error);
            }
        }

        return { processed, warned };
    }

    private async checkAndWarnInvoice(invoice: any, thresholdBytes: number): Promise<boolean> {
        // Get panel adapter
        const adapter = PanelFactory.create(invoice.panel);

        // Get user info from panel
        const panelUser = await adapter.getUser(invoice.username);

        if (!panelUser) {
            return false;
        }

        // Skip if not active
        if (panelUser.status !== 'active') {
            return false;
        }

        // Calculate remaining volume
        const remainingVolume = panelUser.dataLimit - panelUser.usedTraffic;

        // Check if below threshold and still has some data
        if (remainingVolume <= thresholdBytes && remainingVolume > 0) {
            const remainingGB = (remainingVolume / Math.pow(1024, 3)).toFixed(2);

            // Send warning message
            const message = this.formatWarningMessage(
                invoice.username,
                remainingGB,
                invoice.product.name
            );

            try {
                await this.bot.api.sendMessage(
                    invoice.userId,
                    message,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [[
                                {
                                    text: '➕ افزایش حجم',
                                    callback_data: `extend_${invoice.username}`,
                                },
                            ]],
                        },
                    }
                );

                // Update invoice status to prevent duplicate warnings
                const newStatus = invoice.status === 'END_OF_TIME' ? 'SENDEDWARN' : 'END_OF_VOLUME';
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: newStatus as any },
                });

                logger.info(`Sent volume warning to user ${invoice.userId} for service ${invoice.username}`);
                return true;
            } catch (error) {
                logger.error(`Failed to send volume warning to user ${invoice.userId}:`, error);
                return false;
            }
        }

        return false;
    }

    private formatWarningMessage(username: string, remainingGB: string, productName: string): string {
        return `
⚠️ <b>هشدار اتمام حجم</b>

نام کاربری: <code>${username}</code>
محصول: ${productName}

💾 حجم باقیمانده: <b>${remainingGB} GB</b>

حجم سرویس شما رو به اتمام است. برای افزایش حجم اقدام کنید.
        `.trim();
    }

    async close(): Promise<void> {
        await this.worker.close();
        logger.info('VolumeWarningWorker closed');
    }
}
