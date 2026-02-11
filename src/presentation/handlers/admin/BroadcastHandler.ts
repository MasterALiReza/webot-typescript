import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { triggerBroadcast } from '../../../infrastructure/queue/JobScheduler';
import { getBroadcastTargetKeyboard } from '../../keyboards/adminKeyboards';
import { logger } from '../../../shared/logger';

/**
 * BroadcastHandler - Bulk messaging system
 */
export class BroadcastHandler {
    /**
     * Handle admin:broadcast - Show broadcast menu
     */
    static async handleBroadcastMenu(ctx: Context): Promise<void> {
        try {
            const message = `
📢 <b>ارسال پیام انبوه</b>

لطفاً گروه هدف را انتخاب کنید:
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getBroadcastTargetKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing broadcast menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:broadcast:all - Broadcast to all users
     */
    static async handleBroadcastAll(ctx: Context): Promise<void> {
        try {
            const users = await prisma.user.findMany({
                where: {
                    userStatus: 'ACTIVE',
                },
                select: { chatId: true },
            });

            if (users.length === 0) {
                await ctx.answerCallbackQuery({ text: '❌ کاربری یافت نشد' });
                return;
            }

            await this.promptForMessage(ctx, users.map(u => Number(u.chatId)), 'همه کاربران');
        } catch (error) {
            logger.error('Error in broadcast all:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:broadcast:active - Broadcast to active service holders
     */
    static async handleBroadcastActive(ctx: Context): Promise<void> {
        try {
            const activeInvoices = await prisma.invoice.findMany({
                where: {
                    status: 'ACTIVE',
                },
                include: {
                    user: true,
                },
                distinct: ['userId'],
            });

            const userIds = activeInvoices
                .filter(inv => inv.user.userStatus === 'ACTIVE')
                .map(inv => Number(inv.user.chatId));

            if (userIds.length === 0) {
                await ctx.answerCallbackQuery({ text: '❌ کاربری با سرویس فعال یافت نشد' });
                return;
            }

            await this.promptForMessage(ctx, userIds, 'دارندگان سرویس فعال');
        } catch (error) {
            logger.error('Error in broadcast active:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:broadcast:inactive - Broadcast to inactive users
     */
    static async handleBroadcastInactive(ctx: Context): Promise<void> {
        try {
            // Get users without active services
            const usersWithActiveServices = await prisma.invoice.findMany({
                where: {
                    status: 'ACTIVE',
                },
                select: { userId: true },
                distinct: ['userId'],
            });

            const activeUserIds = usersWithActiveServices.map(inv => inv.userId);

            const inactiveUsers = await prisma.user.findMany({
                where: {
                    userStatus: 'ACTIVE',
                    id: {
                        notIn: activeUserIds,
                    },
                },
                select: { chatId: true },
            });

            if (inactiveUsers.length === 0) {
                await ctx.answerCallbackQuery({ text: '❌ کاربری یافت نشد' });
                return;
            }

            await this.promptForMessage(
                ctx,
                inactiveUsers.map(u => Number(u.chatId)),
                'کاربران بدون سرویس فعال'
            );
        } catch (error) {
            logger.error('Error in broadcast inactive:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Prompt admin to send message for broadcast
     */
    private static async promptForMessage(ctx: Context, userIds: number[], targetLabel: string): Promise<void> {
        try {
            const message = `
📢 <b>ارسال پیام انبوه</b>

👥 <b>گروه هدف:</b> ${targetLabel}
📊 <b>تعداد:</b> ${userIds.length} نفر

📝 لطفاً پیام خود را ارسال کنید.

<i>پیام شما به ${userIds.length} نفر ارسال خواهد شد.</i>

⚠️ <b>نکته:</b> از HTML برای قالب‌بندی استفاده کنید.

برای لغو، روی دکمه زیر کلیک کنید:
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '❌ انصراف', callback_data: 'admin:broadcast' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();

            // Store broadcast context for next message
            // Note: In a production app, this would use a state management system
            // For now, this is a placeholder
            logger.info(`Broadcast prepared for ${userIds.length} users`);
        } catch (error) {
            logger.error('Error prompting for message:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Execute broadcast (called after admin sends message)
     * Note: This would typically be triggered by a conversation or state handler
     */
    static async executeBroadcast(
        ctx: Context,
        userIds: number[],
        message: string
    ): Promise<void> {
        try {
            const adminId = ctx.from?.id;

            if (!adminId) {
                await ctx.reply('❌ خطا: شناسایی ادمین ناموفق بود.');
                return;
            }

            // Trigger broadcast job
            await triggerBroadcast(userIds, message, adminId, 'HTML');

            const confirmMessage = `
✅ <b>پیام انبوه در صف ارسال قرار گرفت</b>

👥 تعداد مخاطبین: ${userIds.length}
📊 وضعیت: در حال ارسال...

پس از اتمام ارسال، گزارش نهایی برای شما ارسال خواهد شد.
            `.trim();

            await ctx.reply(confirmMessage, { parse_mode: 'HTML' });

            logger.info(`Broadcast queued by admin ${adminId} for ${userIds.length} users`);
        } catch (error) {
            logger.error('Error executing broadcast:', error);
            await ctx.reply('❌ خطا در ارسال پیام انبوه.');
        }
    }
}
