import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { getUserManagementKeyboard } from '../../keyboards/adminKeyboards';
import { logger } from '../../../shared/logger';

/**
 * UserManagementHandler - User administration and management
 */
export class UserManagementHandler {
    /**
     * Handle admin:users - Show user search
     */
    static async handleUsersMenu(ctx: Context): Promise<void> {
        try {
            const message = `
👥 <b>مدیریت کاربران</b>

برای جستجوی کاربر، شناسه یا نام کاربری را ارسال کنید:

مثال:
• <code>123456789</code> (Chat ID)
• <code>@username</code>

یا از دکمه‌های زیر استفاده کنید:
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📊 آمار کلی', callback_data: 'admin:users:stats' },
                    ], [
                        { text: '👥 کاربران جدید', callback_data: 'admin:users:recent' },
                    ], [
                        { text: '🚫 کاربران مسدود', callback_data: 'admin:users:blocked' },
                    ], [
                        { text: '🔙 بازگشت', callback_data: 'admin:menu' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing users menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle user search by ID
     */
    static async searchUserById(chatId: bigint, ctx: Context): Promise<void> {
        try {
            const user = await prisma.user.findUnique({
                where: { chatId },
                include: {
                    invoices: {
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    },
                },
            });

            if (!user) {
                await ctx.reply('❌ کاربر یافت نشد.');
                return;
            }

            await this.showUserProfile(user, ctx);
        } catch (error) {
            logger.error('Error searching user:', error);
            await ctx.reply('❌ خطا در جستجوی کاربر.');
        }
    }

    /**
     * Handle admin:user:view:{id} - Show user profile
     */
    static async handleViewUser(ctx: Context, userId: number): Promise<void> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    invoices: {
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    },
                },
            });

            if (!user) {
                await ctx.answerCallbackQuery({ text: '❌ کاربر یافت نشد' });
                return;
            }

            await this.showUserProfile(user, ctx);
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error viewing user:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Show detailed user profile
     */
    private static async showUserProfile(user: any, ctx: Context): Promise<void> {
        const statusEmoji = user.userStatus === 'ACTIVE' ? '✅' : '🚫';
        const statusText = user.userStatus === 'ACTIVE' ? 'فعال' : 'مسدود';

        const activeServices = user.invoices.filter((inv: any) => inv.status === 'ACTIVE').length;

        const message = `
👤 <b>پروفایل کاربر</b>

🆔 <b>شناسه:</b> <code>${user.chatId}</code>
👤 <b>نام:</b> ${user.firstName || 'ندارد'}
📱 <b>شماره:</b> ${user.phoneNumber || 'ندارد'}
💰 <b>موجودی:</b> ${Number(user.balance).toLocaleString('fa-IR')} تومان

${statusEmoji} <b>وضعیت:</b> ${statusText}
✅ <b>تایید شده:</b> ${user.isVerified ? 'بله' : 'خیر'}

📊 <b>آمار:</b>
• سرویس‌های فعال: ${activeServices}
• کل سرویس‌ها: ${user.invoices.length}
• زیرمجموعه‌ها: ${user.affiliateCount}

📅 <b>تاریخ ثبت‌نام:</b> ${new Date(user.createdAt).toLocaleDateString('fa-IR')}

🔗 <b>کد معرف:</b> <code>${user.refCode}</code>
        `.trim();

        if (ctx.callbackQuery) {
            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getUserManagementKeyboard(user.id),
            });
        } else {
            await ctx.reply(message, {
                parse_mode: 'HTML',
                reply_markup: getUserManagementKeyboard(user.id),
            });
        }
    }

    /**
     * Handle admin:user:services:{id} - Show user services
     */
    static async handleUserServices(ctx: Context, userId: number): Promise<void> {
        try {
            const invoices = await prisma.invoice.findMany({
                where: { userId },
                include: {
                    product: true,
                    panel: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (invoices.length === 0) {
                await ctx.editMessageText('❌ این کاربر سرویسی ندارد.', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 بازگشت', callback_data: `admin:user:view:${userId}` },
                        ]],
                    },
                });
                await ctx.answerCallbackQuery();
                return;
            }

            let message = '🔐 <b>سرویس‌های کاربر:</b>\n\n';

            for (const invoice of invoices.slice(0, 10)) {
                const statusEmoji = this.getStatusEmoji(invoice.status);
                message += `${statusEmoji} <b>${invoice.product.name}</b>\n`;
                message += `   پنل: ${invoice.panel.name}\n`;
                message += `   نام کاربری: <code>${invoice.username}</code>\n`;
                message += `   وضعیت: ${invoice.status}\n\n`;
            }

            if (invoices.length > 10) {
                message += `\n📌 ${invoices.length - 10} سرویس دیگر...`;
            }

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: `admin:user:view:${userId}` },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing user services:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:user:ban:{id} - Ban user
     */
    static async handleBanUser(ctx: Context, userId: number): Promise<void> {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { userStatus: 'BLOCKED' },
            });

            await ctx.answerCallbackQuery({ text: '✅ کاربر مسدود شد' });

            // Refresh user view
            await this.handleViewUser(ctx, userId);

            logger.info(`User ${userId} banned by admin ${ctx.from?.id}`);
        } catch (error) {
            logger.error('Error banning user:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:user:unban:{id} - Unban user
     */
    static async handleUnbanUser(ctx: Context, userId: number): Promise<void> {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { userStatus: 'ACTIVE' },
            });

            await ctx.answerCallbackQuery({ text: '✅ مسدودی کاربر رفع شد' });

            // Refresh user view
            await this.handleViewUser(ctx, userId);

            logger.info(`User ${userId} unbanned by admin ${ctx.from?.id}`);
        } catch (error) {
            logger.error('Error unbanning user:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:users:recent - Show recent users
     */
    static async handleRecentUsers(ctx: Context): Promise<void> {
        try {
            const users = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
            });

            let message = '👥 <b>کاربران جدید (20 نفر اخیر):</b>\n\n';

            for (const user of users) {
                const statusEmoji = user.userStatus === 'ACTIVE' ? '✅' : '🚫';
                message += `${statusEmoji} ${user.firstName || 'بدون نام'} - <code>${user.chatId}</code>\n`;
                message += `   💰 موجودی: ${Number(user.balance).toLocaleString('fa-IR')} تومان\n`;
                message += `   📅 ${new Date(user.createdAt).toLocaleDateString('fa-IR')}\n\n`;
            }

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: 'admin:users' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing recent users:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:users:blocked - Show blocked users
     */
    static async handleBlockedUsers(ctx: Context): Promise<void> {
        try {
            const users = await prisma.user.findMany({
                where: { userStatus: 'BLOCKED' },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });

            if (users.length === 0) {
                await ctx.editMessageText('✅ هیچ کاربر مسدودی وجود ندارد.', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 بازگشت', callback_data: 'admin:users' },
                        ]],
                    },
                });
                await ctx.answerCallbackQuery();
                return;
            }

            let message = '🚫 <b>کاربران مسدود:</b>\n\n';

            for (const user of users) {
                message += `❌ ${user.firstName || 'بدون نام'} - <code>${user.chatId}</code>\n`;
                message += `   📅 ${new Date(user.createdAt).toLocaleDateString('fa-IR')}\n\n`;
            }

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: 'admin:users' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing blocked users:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:user:add_balance:{id} - Prompt for amount
     * Note: For now this is a placeholder. Full implementation will use conversation or inline input
     */
    static async handleAddBalance(ctx: Context, userId: number): Promise<void> {
        try {
            await ctx.editMessageText(
                '💰 برای افزایش موجودی، لطفاً از طریق دستور زیر اقدام کنید:\n\n' +
                '<code>/addbalance {userId} {amount}</code>\n\n' +
                'این ویژگی به زودی با فرم تعاملی بهبود می‌یابد.',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 بازگشت', callback_data: `admin:user:view:${userId}` },
                        ]],
                    },
                }
            );
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in add balance handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:user:sub_balance:{id} - Prompt for amount
     */
    static async handleSubtractBalance(ctx: Context, userId: number): Promise<void> {
        try {
            await ctx.editMessageText(
                '💰 برای کاهش موجودی، لطفاً از طریق دستور زیر اقدام کنید:\n\n' +
                '<code>/subbalance {userId} {amount}</code>\n\n' +
                'این ویژگی به زودی با فرم تعاملی بهبود می‌یابد.',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 بازگشت', callback_data: `admin:user:view:${userId}` },
                        ]],
                    },
                }
            );
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in subtract balance handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:user:send_msg:{id} - Send message to user
     */
    static async handleSendMessage(ctx: Context, userId: number): Promise<void> {
        try {
            await ctx.editMessageText(
                '💬 برای ارسال پیام، از دستور زیر استفاده کنید:\n\n' +
                '<code>/sendmsg {userId} {message}</code>\n\n' +
                'این ویژگی به زودی با فرم تعاملی بهبود می‌یابد.',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 بازگشت', callback_data: `admin:user:view:${userId}` },
                        ]],
                    },
                }
            );
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in send message handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    // Helper method
    private static getStatusEmoji(status: string): string {
        const emojiMap: Record<string, string> = {
            ACTIVE: '✅',
            PENDING: '⏳',
            DISABLED: '❌',
            REMOVED: '🗑',
            EXPIRED: '⏰',
        };
        return emojiMap[status] || '❓';
    }
}
