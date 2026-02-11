import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { getStatsKeyboard } from '../../keyboards/adminKeyboards';
import { logger } from '../../../shared/logger';

/**
 * StatisticsHandler - Comprehensive statistics and analytics
 */
export class StatisticsHandler {
    /**
     * Handle admin:stats callback - Show statistics menu
     */
    static async handleStatsMenu(ctx: Context): Promise<void> {
        try {
            const message = `
📊 <b>آمار و گزارشات</b>

لطفاً نوع آمار مورد نظر را انتخاب کنید:
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getStatsKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing stats menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:stats:users - User statistics
     */
    static async handleUserStats(ctx: Context): Promise<void> {
        try {
            const stats = await this.getUserStatistics();

            const message = `
👥 <b>آمار کاربران</b>

📊 <b>کل کاربران:</b> ${stats.total}
📈 <b>کاربران امروز:</b> ${stats.today}
📅 <b>کاربران این هفته:</b> ${stats.thisWeek}
📆 <b>کاربران این ماه:</b> ${stats.thisMonth}
🚫 <b>کاربران مسدود:</b> ${stats.banned}

💰 <b>میانگین موجودی:</b> ${stats.avgBalance.toLocaleString('fa-IR')} تومان
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getStatsKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing user stats:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:stats:sales - Sales statistics
     */
    static async handleSalesStats(ctx: Context): Promise<void> {
        try {
            const stats = await this.getSalesStatistics();

            const message = `
💰 <b>آمار فروش</b>

💵 <b>درآمد امروز:</b> ${stats.today.toLocaleString('fa-IR')} تومان
📅 <b>درآمد این هفته:</b> ${stats.thisWeek.toLocaleString('fa-IR')} تومان
📆 <b>درآمد این ماه:</b> ${stats.thisMonth.toLocaleString('fa-IR')} تومان
📊 <b>کل درآمد:</b> ${stats.total.toLocaleString('fa-IR')} تومان

📦 <b>تعداد سفارشات:</b> ${stats.totalOrders}
✅ <b>موفق:</b> ${stats.successfulOrders}
❌ <b>ناموفق:</b> ${stats.failedOrders}
⏳ <b>در انتظار:</b> ${stats.pendingOrders}
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getStatsKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing sales stats:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:stats:services - Service statistics
     */
    static async handleServiceStats(ctx: Context): Promise<void> {
        try {
            const stats = await this.getServiceStatistics();

            const message = `
🔐 <b>آمار سرویس‌ها</b>

✅ <b>سرویس‌های فعال:</b> ${stats.active}
⏸ <b>در حال انتظار:</b> ${stats.onHold}
❌ <b>منقضی شده:</b> ${stats.expired}
🚫 <b>غیرفعال:</b> ${stats.disabled}

⚠️ <b>انقضا نزدیک:</b>
  • 1 روز: ${stats.expiringSoon.oneDay}
  • 3 روز: ${stats.expiringSoon.threeDays}
  • 7 روز: ${stats.expiringSoon.sevenDays}

📊 <b>حجم مصرفی کل:</b> ${(stats.totalTraffic / Math.pow(1024, 3)).toFixed(2)} GB
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getStatsKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing service stats:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:stats:panels - Panel statistics
     */
    static async handlePanelStats(ctx: Context): Promise<void> {
        try {
            const stats = await this.getPanelStatistics();

            let message = `
🖥 <b>آمار پنل‌ها</b>

📊 <b>تعداد پنل‌ها:</b> ${stats.totalPanels}
✅ <b>فعال:</b> ${stats.activePanels}
❌ <b>غیرفعال:</b> ${stats.inactivePanels}

<b>توزیع سرویس‌ها:</b>
`;

            for (const panel of stats.servicesByPanel) {
                message += `\n• ${panel.name}: ${panel.count} سرویس`;
            }

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getStatsKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing panel stats:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    // ==================== Statistics Calculations ====================

    private static async getUserStatistics() {
        const total = await prisma.user.count();

        const today = await this.getUserCountSince(this.getStartOfDay());
        const thisWeek = await this.getUserCountSince(this.getStartOfWeek());
        const thisMonth = await this.getUserCountSince(this.getStartOfMonth());

        const banned = await prisma.user.count({
            where: { userStatus: 'BLOCKED' },
        });

        const balanceAgg = await prisma.user.aggregate({
            _avg: { balance: true },
        });

        return {
            total,
            today,
            thisWeek,
            thisMonth,
            banned,
            avgBalance: Number(balanceAgg._avg.balance || 0),
        };
    }

    private static async getSalesStatistics() {
        const today = await this.getRevenueSince(this.getStartOfDay());
        const thisWeek = await this.getRevenueSince(this.getStartOfWeek());
        const thisMonth = await this.getRevenueSince(this.getStartOfMonth());

        const totalAgg = await prisma.paymentReport.aggregate({
            where: { status: 'PAID' },
            _sum: { amount: true },
        });

        const total = Number(totalAgg._sum.amount || 0);

        const totalOrders = await prisma.invoice.count();
        const successfulOrders = await prisma.invoice.count({ where: { status: 'ACTIVE' } });
        const failedOrders = await prisma.invoice.count({ where: { status: 'DISABLED' } });
        const pendingOrders = await prisma.invoice.count({ where: { status: 'PENDING' } });

        return {
            today,
            thisWeek,
            thisMonth,
            total,
            totalOrders,
            successfulOrders,
            failedOrders,
            pendingOrders,
        };
    }

    private static async getServiceStatistics() {
        const active = await prisma.invoice.count({ where: { status: 'ACTIVE' } });
        const onHold = await prisma.invoice.count({ where: { status: 'PENDING' } });
        const expired = await prisma.invoice.count({ where: { status: 'REMOVED' } });
        const disabled = await prisma.invoice.count({ where: { status: 'DISABLED' } });

        // Count services expiring soon (simplified - would need panel integration for actual expiry dates)
        const expiringSoon = {
            oneDay: 0,
            threeDays: 0,
            sevenDays: 0,
        };

        // Total traffic (placeholder - would need panel integration)
        const totalTraffic = 0;

        return {
            active,
            onHold,
            expired,
            disabled,
            expiringSoon,
            totalTraffic,
        };
    }

    private static async getPanelStatistics() {
        const totalPanels = await prisma.panel.count();
        const activePanels = await prisma.panel.count({ where: { status: 'ACTIVE' } });
        const inactivePanels = totalPanels - activePanels;

        const servicesByPanel = await prisma.panel.findMany({
            select: {
                name: true,
                _count: {
                    select: { invoices: true },
                },
            },
        });

        return {
            totalPanels,
            activePanels,
            inactivePanels,
            servicesByPanel: servicesByPanel.map(p => ({
                name: p.name,
                count: p._count.invoices,
            })),
        };
    }

    // ==================== Helper Methods ====================

    private static async getUserCountSince(since: Date): Promise<number> {
        return await prisma.user.count({
            where: {
                createdAt: { gte: since },
            },
        });
    }

    private static async getRevenueSince(since: Date): Promise<number> {
        const result = await prisma.paymentReport.aggregate({
            where: {
                status: 'PAID',
                createdAt: { gte: since },
            },
            _sum: { amount: true },
        });

        return Number(result._sum.amount || 0);
    }

    private static getStartOfDay(): Date {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    private static getStartOfWeek(): Date {
        const date = new Date();
        const day = date.getDay();
        const diff = date.getDate() - day;
        date.setDate(diff);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    private static getStartOfMonth(): Date {
        const date = new Date();
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        return date;
    }
}
