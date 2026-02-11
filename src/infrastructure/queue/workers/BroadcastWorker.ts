import { Worker, Job } from 'bullmq';
import { redisConnection } from '../RedisConnection';
import { logger } from '../../../shared/logger';
import { config } from '../../../shared/config';
import { Bot } from 'grammy';

export interface BroadcastJobData {
    userIds: number[];
    message: string;
    parseMode?: 'HTML' | 'Markdown';
    adminId?: number;
}

/**
 * BroadcastWorker - Sends bulk messages to users
 * Rate-limited to respect Telegram API limits
 * Based on sendmessage.php from original project
 */
export class BroadcastWorker {
    private worker: Worker;
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;

        this.worker = new Worker(
            'broadcast',
            async (job: Job<BroadcastJobData>) => {
                return await this.processJob(job);
            },
            {
                connection: redisConnection,
                concurrency: 1, // Sequential processing to respect rate limits
                limiter: {
                    max: 1,
                    duration: 1000, // 1 job per second
                },
            }
        );

        this.worker.on('completed', (job) => {
            logger.info(`Broadcast job ${job.id} completed`);
        });

        this.worker.on('failed', (job, error) => {
            logger.error(`Broadcast job ${job?.id} failed:`, error);
        });

        logger.info('BroadcastWorker initialized');
    }

    private async processJob(job: Job<BroadcastJobData>): Promise<{ sent: number; failed: number; total: number }> {
        const { userIds, message, parseMode = 'HTML', adminId } = job.data;
        const chunkSize = config.BROADCAST_CHUNK_SIZE; // Messages per second

        logger.info(`Processing broadcast to ${userIds.length} users (chunk size: ${chunkSize})`);

        let sent = 0;
        let failed = 0;

        // Process in chunks to respect Telegram rate limits (30 msg/sec)
        for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);

            // Send messages in parallel within chunk
            const results = await Promise.allSettled(
                chunk.map(userId => this.sendMessage(userId, message, parseMode))
            );

            // Count successes and failures
            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    sent++;
                } else {
                    failed++;
                    logger.warn(`Failed to send to user ${chunk[idx]}:`, result.reason);
                }
            });

            // Update job progress
            const progress = Math.floor(((i + chunk.length) / userIds.length) * 100);
            await job.updateProgress(progress);

            // Wait 1 second before next chunk (rate limiting)
            if (i + chunkSize < userIds.length) {
                await this.sleep(1000);
            }
        }

        // Notify admin when complete
        if (adminId) {
            try {
                const completionMessage = this.formatCompletionMessage(sent, failed, userIds.length);
                await this.bot.api.sendMessage(adminId, completionMessage, { parse_mode: 'HTML' });
            } catch (error) {
                logger.warn('Failed to notify admin about broadcast completion:', error);
            }
        }

        logger.info(`Broadcast completed: ${sent} sent, ${failed} failed out of ${userIds.length}`);

        return { sent, failed, total: userIds.length };
    }

    private async sendMessage(userId: number, message: string, parseMode: 'HTML' | 'Markdown'): Promise<void> {
        try {
            await this.bot.api.sendMessage(userId, message, {
                parse_mode: parseMode,
            });
        } catch (error) {
            // Re-throw to be caught by Promise.allSettled
            throw error;
        }
    }

    private formatCompletionMessage(sent: number, failed: number, total: number): string {
        const successRate = ((sent / total) * 100).toFixed(1);

        return `
📢 <b>گزارش ارسال پیام انبوه</b>

✅ موفق: ${sent}
❌ ناموفق: ${failed}
📊 کل: ${total}
📈 نرخ موفقیت: ${successRate}%

ارسال پیام‌ها با موفقیت به پایان رسید.
        `.trim();
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close(): Promise<void> {
        await this.worker.close();
        logger.info('BroadcastWorker closed');
    }
}
