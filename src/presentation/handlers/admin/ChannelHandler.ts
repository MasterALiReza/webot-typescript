import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/logger';

/**
 * ChannelHandler - Manage required channels for bot access
 */
export class ChannelHandler {
    /**
     * Handle admin:channels - Show channel management menu
     */
    static async handleChannelsMenu(ctx: Context): Promise<void> {
        try {
            const channels = await prisma.channel.findMany({
                orderBy: { createdAt: 'desc' }
            });

            let message = '📺 <b>مدیریت کانال‌های قفل</b>\n\n' +
                'لیست کانال‌هایی که کاربر برای استفاده از ربات باید عضو آن‌ها باشد:\n\n';

            if (channels.length === 0) {
                message += '❌ هیچ کانالی ثبت نشده است.\n';
            } else {
                channels.forEach((channel, index) => {
                    message += `${index + 1}. <b>${channel.name}</b>\n` +
                        `   ID: <code>${channel.chatId}</code>\n` +
                        `   Link: ${channel.link}\n` +
                        `   /delchannel_${channel.id}\n\n`;
                });
            }

            message += '\nبرای افزودن کانال جدید، از دکمه زیر استفاده کنید.';

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ افزودن کانال جدید', callback_data: 'admin:channel:add' }],
                        [{ text: '🔙 بازگشت', callback_data: 'admin:menu' }],
                    ],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing channels menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Check if user is member of required channels
     */
    static async checkUserMembership(ctx: Context, userId: number): Promise<boolean> {
        try {
            const channels = await prisma.channel.findMany();
            if (channels.length === 0) return true;

            for (const channel of channels) {
                try {
                    const member = await ctx.api.getChatMember(channel.chatId, userId);
                    if (!['creator', 'administrator', 'member'].includes(member.status)) {
                        return false;
                    }
                } catch (err) {
                    logger.warn(`Failed to check membership for channel ${channel.chatId}:`, err);
                    // Generate link for user to join
                    // Return false to block user
                    return false;
                }
            }

            return true;
        } catch (error) {
            logger.error('Error checking user membership:', error);
            return true; // Don't block on system error, or false for strict security?
            // Safer to allow access if DB fails, to avoid total lockout
        }
    }

    /**
     * Get missing channels for a user
     */
    static async getMissingChannels(ctx: Context, userId: number): Promise<any[]> {
        const missing = [];
        try {
            const channels = await prisma.channel.findMany();
            for (const channel of channels) {
                try {
                    const member = await ctx.api.getChatMember(channel.chatId, userId);
                    if (!['creator', 'administrator', 'member'].includes(member.status)) {
                        missing.push(channel);
                    }
                } catch (err) {
                    logger.warn(`Failed to check membership for channel ${channel.chatId}:`, err);
                    missing.push(channel); // Assume missing if check fails
                }
            }
        } catch (error) {
            logger.error('Error getting missing channels:', error);
        }
        return missing;
    }

    /**
     * Handle admin:channel:add - Start add flow
     */
    static async handleAddChannel(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        const { AdminConversationHandler, AdminState } = require('./AdminConversationHandler');
        AdminConversationHandler.setState(userId, AdminState.WAITING_CHANNEL_ADD_NAME);

        await ctx.editMessageText(
            '📺 <b>افزودن کانال جدید</b>\n\n' +
            'ابتدا، لطفاً <b>نام نمایشی کانال</b> را ارسال کنید:\n' +
            '(مثلاً: کانال اطلاع‌رسانی)',
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin:channels' }]]
                }
            }
        );
        await ctx.answerCallbackQuery();
    }

    /**
     * Handle deleting a channel
     */
    static async handleDeleteChannel(ctx: Context, channelId: number): Promise<void> {
        try {
            await prisma.channel.delete({ where: { id: channelId } });
            await ctx.reply('✅ کانال با موفقیت حذف شد.');
            // Refresh menu logic or notify user to go back
            // Since this might be triggered via command /delchannel_xxx, we can show menu again handled by next message or just reply
        } catch (error) {
            logger.error('Error deleting channel:', error);
            await ctx.reply('❌ خطا در حذف کانال.');
        }
    }
}
