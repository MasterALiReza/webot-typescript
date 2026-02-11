import { Worker, Job } from 'bullmq';
import { redisConnection } from '../RedisConnection';
import { prisma } from '../../database/prisma';
import { PanelFactory } from '../../panels/PanelFactory';
import { logger } from '../../../shared/logger';
import { config } from '../../../shared/config';
import { Bot } from 'grammy';

export interface ExpiryWarningJobData {
    batchSize?: number;
}

/**
 * ExpiryWarningWorker - Checks for services nearing expiration
 * Sends warnings at 1, 3, and 7 days before expiry
 * Based on cronday.php from original project
 */
export class ExpiryWarningWorker {
    private worker: Worker;
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;

        this.worker = new Worker(
            'expiry-warning',
            async (job: Job<ExpiryWarningJobData>) => {
                return await this.processJob(job);
            },
            {
                connection: redisConnection,
                concurrency: 5, // Process 5 jobs concurrently
                limiter: {
                    max: 10,
                    duration: 60000, // Max 10 jobs per minute
                },
            }
        );

        // Worker event handlers
        this.worker.on('completed', (job) => {
            logger.info(`Expiry warning job ${job.id} completed`);
        });

        this.worker.on('failed', (job, error) => {
            logger.error(`Expiry warning job ${job?.id} failed:`, error);
        });

        this.worker.on('error', (error) => {
            logger.error('Expiry warning worker error:', error);
        });

        logger.info('ExpiryWarningWorker initialized');
    }

    private async processJob(job: Job<ExpiryWarningJobData>): Promise<{ processed: number; warned: number }> {
        const batchSize = job.data.batchSize || 5;
        const warningDays = config.EXPIRY_WARNING_DAYS.split(',').map(d => parseInt(d.trim(), 10));

        logger.info(`Processing expiry warnings (batch size: ${batchSize})`);

        // Get active and end_of_volume invoices (excluding test accounts)
        const invoices = await prisma.invoice.findMany({
            where: {
                status: {
                    in: ['ACTIVE', 'END_OF_VOLUME'],
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
            orderBy: {
                createdAt: 'desc',
            },
        });

        let processed = 0;
        let warned = 0;

        for (const invoice of invoices) {
            try {
                await this.checkAndWarnInvoice(invoice, warningDays);
                processed++;
            } catch (error) {
                logger.error(`Error processing invoice ${invoice.id}:`, error);
            }
        }

        return { processed, warned };
    }

    private async checkAndWarnInvoice(invoice: any, warningDays: number[]) {
        // Get panel adapter
        const adapter = PanelFactory.create(invoice.panel);

        // Get user info from panel
        const panelUser = await adapter.getUser(invoice.username);

        if (!panelUser || panelUser.status === 'Unsuccessful') {
            return;
        }

        // Only process active or on_hold services
        if (!['active', 'on_hold'].includes(panelUser.status)) {
            // Update invoice status if service is disabled
            if (panelUser.status === 'disabled') {
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: 'DISABLED' },
                });
            }
            return;
        }

        // Calculate days until expiry
        const timeUntilExpiry = panelUser.expire - Math.floor(Date.now() / 1000);
        const daysUntilExpiry = Math.floor(timeUntilExpiry / 86400) + 1;

        // Check if we should send warning
        const shouldWarn = warningDays.includes(daysUntilExpiry) && timeUntilExpiry > 0;

        if (shouldWarn && timeUntilExpiry <= 167000) { // ~1.9 days in seconds
            // Calculate remaining volume
            const remainingVolume = panelUser.dataLimit - panelUser.usedTraffic;
            const remainingGB = (remainingVolume / Math.pow(1024, 3)).toFixed(2);

            // Send warning message
            const message = this.formatWarningMessage(
                invoice.username,
                daysUntilExpiry,
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
                                    text: '🔄 تمدید سرویس',
                                    callback_data: `extend_${invoice.username}`,
                                },
                            ]],
                        },
                    }
                );

                // Update invoice status to prevent duplicate warnings
                const newStatus = invoice.status === 'END_OF_VOLUME' ? 'SENDEDWARN' : 'END_OF_TIME';
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: newStatus as any },
                });

                logger.info(`Sent expiry warning to user ${invoice.userId} for service ${invoice.username}`);
            } catch (error) {
                logger.error(`Failed to send warning to user ${invoice.userId}:`, error);
            }
        }
    }

    private formatWarningMessage(
        username: string,
        daysRemaining: number,
        remainingGB: string,
        productName: string
    ): string {
        return `
⚠️ <b>هشدار انقضای سرویس</b>

نام کاربری: <code>${username}</code>
محصول: ${productName}

⏰ زمان باقیمانده: <b>${daysRemaining} روز</b>
💾 حجم باقیمانده: <b>${remainingGB} GB</b>

برای تمدید سرویس خود اقدام کنید.
        `.trim();
    }

    async close(): Promise<void> {
        await this.worker.close();
        logger.info('ExpiryWarningWorker closed');
    }
}
