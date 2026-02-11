import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { getAdminMainKeyboard } from '../../keyboards/adminKeyboards';
import { logger } from '../../../shared/logger';

/**
 * AdminMenuHandler - Main admin dashboard
 * Shows quick stats and navigation buttons
 */
export class AdminMenuHandler {
    /**
     * Handle /admin command
     */
    static async handleAdminCommand(ctx: Context): Promise<void> {
        try {
            // Get quick statistics
            const stats = await this.getQuickStats();

            const message = `
🔐 <b>پنل مدیریت</b>

📊 <b>آمار سریع:</b>
👥 کاربران: ${stats.totalUsers}
✅ سرویس‌های فعال: ${stats.activeServices}
💰 درآمد امروز: ${stats.todayRevenue.toLocaleString('fa-IR')} تومان
⏳ پرداخت‌های در انتظار: ${stats.pendingPayments}

از منوی زیر گزینه مورد نظر را انتخاب کنید:
            `.trim();

            await ctx.reply(message, {
                parse_mode: 'HTML',
                reply_markup: getAdminMainKeyboard(),
            });

            logger.info(`Admin menu displayed to user ${ctx.from?.id}`);
        } catch (error) {
            logger.error('Error displaying admin menu:', error);
            await ctx.reply('❌ خطا در نمایش پنل مدیریت.');
        }
    }

    /**
     * Handle admin:menu callback
     */
    static async handleAdminMenuCallback(ctx: Context): Promise<void> {
        try {
            const stats = await this.getQuickStats();

            const message = `
🔐 <b>پنل مدیریت</b>

📊 <b>آمار سریع:</b>
👥 کاربران: ${stats.totalUsers}
✅ سرویس‌های فعال: ${stats.activeServices}
💰 درآمد امروز: ${stats.todayRevenue.toLocaleString('fa-IR')} تومان
⏳ پرداخت‌های در انتظار: ${stats.pendingPayments}

از منوی زیر گزینه مورد نظر را انتخاب کنید:
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getAdminMainKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error handling admin menu callback:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Get quick statistics for dashboard
     */
    private static async getQuickStats() {
        // Total users
        const totalUsers = await prisma.user.count();

        // Active services
        const activeServices = await prisma.invoice.count({
            where: {
                status: 'ACTIVE',
            },
        });

        // Today's revenue
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const todayPayments = await prisma.paymentReport.aggregate({
            where: {
                status: 'PAID',
                createdAt: {
                    gte: startOfDay,
                },
            },
            _sum: {
                amount: true,
            },
        });

        const todayRevenue = Number(todayPayments._sum.amount || 0);

        // Pending payments
        const pendingPayments = await prisma.paymentReport.count({
            where: {
                status: 'PENDING',
            },
        });

        return {
            totalUsers,
            activeServices,
            todayRevenue,
            pendingPayments,
        };
    }
}
