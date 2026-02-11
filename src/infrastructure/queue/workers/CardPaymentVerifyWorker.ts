import { Worker, Job } from 'bullmq';
import { redisConnection } from '../RedisConnection';
import { prisma } from '../../database/prisma';
import { logger } from '../../../shared/logger';
import { config } from '../../../shared/config';
import { Bot } from 'grammy';

export interface CardPaymentVerifyJobData {
    batchSize?: number;
}

/**
 * CardPaymentVerifyWorker - Auto-verify card-to-card payments
 * Checks pending payments with uploaded receipts
 * Based on croncard.php from original project
 */
export class CardPaymentVerifyWorker {
    private worker: Worker;
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;

        this.worker = new Worker(
            'card-payment-verify',
            async (job: Job<CardPaymentVerifyJobData>) => {
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
            logger.info(`Card payment verify job ${job.id} completed`);
        });

        this.worker.on('failed', (job, error) => {
            logger.error(`Card payment verify job ${job?.id} failed:`, error);
        });

        logger.info('CardPaymentVerifyWorker initialized');
    }

    private async processJob(job: Job<CardPaymentVerifyJobData>): Promise<{ processed: number; verified: number }> {
        const batchSize = job.data.batchSize || 10;

        logger.info(`Processing card payment verification (batch size: ${batchSize})`);

        // Get pending card-to-card payments with photos uploaded
        const payments = await prisma.paymentReport.findMany({
            where: {
                status: 'PENDING',
                method: 'CARD_TO_CARD',
                photoId: {
                    not: null,
                },
            },
            include: {
                user: true,
            },
            take: batchSize,
            orderBy: {
                createdAt: 'desc',
            },
        });

        let processed = 0;
        let verified = 0;

        for (const payment of payments) {
            try {
                // Check if payment is recent (within last hour)
                const timeSinceCreated = Date.now() - payment.createdAt.getTime();
                const oneHour = 3600 * 1000;

                if (timeSinceCreated < oneHour) {
                    // Auto-verify if photo exists
                    if (payment.photoId) {
                        await this.verifyPayment(payment);
                        verified++;
                    }
                }

                processed++;
            } catch (error) {
                logger.error(`Error processing payment ${payment.id}:`, error);
            }
        }

        return { processed, verified };
    }

    private async verifyPayment(payment: any) {
        try {
            // Update payment status
            await prisma.paymentReport.update({
                where: { id: payment.id },
                data: {
                    status: 'PAID',
                    description: payment.description
                        ? `${payment.description}\nConfirmed by robot`
                        : 'Confirmed by robot',
                },
            });

            // Process the payment (add balance, create service, etc.)
            // This would call the DirectPayment function equivalent
            await this.processDirectPayment(payment);

            // Notify admin channel if configured
            if (config.REPORT_CHANNEL_ID) {
                const adminMessage = `
💳 <b>پرداخت کارت‌به‌کارت تایید خودکار</b>

شناسه کاربر: ${payment.userId}
مبلغ: ${payment.amount.toString()} تومان
شماره سفارش: <code>${payment.orderId}</code>

✅ پرداخت به صورت خودکار تایید شد.
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

            logger.info(`Auto-verified card payment ${payment.orderId} for user ${payment.userId}`);
        } catch (error) {
            logger.error(`Failed to verify payment ${payment.orderId}:`, error);
            throw error;
        }
    }

    private async processDirectPayment(payment: any) {
        // This is a placeholder for the DirectPayment logic
        // In the original PHP, this would:
        // 1. Add balance to user account
        // 2. Create invoice/service if order exists
        // 3. Send confirmation to user

        logger.info(`Processing direct payment for order ${payment.orderId}`);

        // Note: The actual implementation would depend on the
        // payment handling logic in your application
    }

    async close(): Promise<void> {
        await this.worker.close();
        logger.info('CardPaymentVerifyWorker closed');
    }
}
