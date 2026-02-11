import { Context } from 'grammy';
import { getSupportMenuKeyboard } from '../../keyboards/userKeyboards';


import { logger } from '../../../shared/logger';

import { prisma } from '../../../infrastructure/database/prisma';
import { UserConversationHandler, UserState } from './UserConversationHandler';

export class SupportHandler {
    /**
     * Show support menu
     */
    async showSupport(ctx: Context) {
        try {
            await ctx.reply(
                `💬 **پشتیبانی آنلاین**\n\n` +
                `برای ارتباط با پشتیبانی یا مشاهده سوالات متداول، از گزینه‌های زیر استفاده کنید.\n\n` +
                `📞 ساعات پاسخگویی: ۱۰ صبح تا ۱۰ شب`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: getSupportMenuKeyboard(),
                }
            );
        } catch (error) {
            logger.error('Error in showSupport:', error);
            await ctx.reply('❌ خطا در نمایش منوی پشتیبانی');
        }
    }

    /**
     * Handle new ticket request
     */
    async handleNewTicket(ctx: Context) {
        if (!ctx.from) return;

        await ctx.reply('📝 لطفاً پیام خود را بنویسید:\n(متن پیام را در یک مرحله ارسال کنید)', {
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 لغو', callback_data: 'support' }]]
            }
        });

        UserConversationHandler.setState(ctx.from.id, UserState.WAITING_TICKET_MESSAGE);
        await ctx.answerCallbackQuery();
    }

    /**
     * Handle my tickets list
     */
    async handleMyTickets(ctx: Context) {
        if (!ctx.from) return;

        try {
            const user = await prisma.user.findUnique({ where: { chatId: BigInt(ctx.from.id) } });
            if (!user) return;

            const tickets = await prisma.supportTicket.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            if (tickets.length === 0) {
                await ctx.reply('📭 شما هنوز تیکتی ثبت نکرده‌اید.', {
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'support' }]]
                    }
                });
                await ctx.answerCallbackQuery();
                return;
            }

            let msg = '📋 **لیست تیکت‌های شما:**\n\n';
            tickets.forEach(t => {
                const statusEmoji = t.status === 'OPEN' ? '🟡' : (t.status === 'ANSWERED' ? '🟢' : '⚫️');
                const date = t.createdAt.toLocaleDateString('fa-IR');
                msg += `${statusEmoji} <b>تیکت #${t.id}</b>\n📅 ${date}\n📝 ${t.message.substring(0, 30)}...\n\n`;
                if (t.response) {
                    msg += `↪️ <b>پاسخ:</b>\n${t.response}\n\n`;
                }
                msg += '──────────────\n';
            });

            await ctx.reply(msg, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'support' }]]
                }
            });
            await ctx.answerCallbackQuery();

        } catch (error) {
            logger.error('Error in handleMyTickets:', error);
            await ctx.reply('❌ خطا در دریافت لیست تیکت‌ها');
        }
    }

    /**
     * Show contact info
     */
    async showContactInfo(ctx: Context) {
        try {
            // In a real app, these should be in config
            // const supportId = config.ADMIN_CHAT_ID;

            await ctx.reply(
                `📞 **اطلاعات تماس**\n\n` +
                `ایمیل: support@webot.com\n` +
                `کانال اطلاع‌رسانی: @WeBotChannel\n\n` +
                `برای ارسال پیام مستقیم به ادمین، از دکمه "ارسال تیکت" استفاده کنید.`
            );
        } catch (error) {
            logger.error('Error in showContactInfo:', error);
            await ctx.reply('❌ خطا در نمایش اطلاعات تماس');
        }
    }

    /**
     * Show FAQ
     */
    async showFAQ(ctx: Context) {
        try {
            await ctx.reply(
                `❓ **سوالات متداول**\n\n` +
                `1️⃣ **چگونه خرید کنم؟**\n` +
                `از منوی اصلی دکمه "خرید سرویس" را بزنید و پلن مورد نظر را انتخاب کنید.\n\n` +
                `2️⃣ **چگونه تمدید کنم؟**\n` +
                `از بخش "سرویس‌های من"، سرویس مورد نظر را انتخاب و دکمه تمدید را بزنید.\n\n` +
                `3️⃣ **سرعت سرویس‌ها چطور است؟**\n` +
                `تمامی سرویس‌ها از سرورهای اختصاصی و پرسرعت استفاده می‌کنند.`,
                {
                    parse_mode: 'Markdown',
                }
            );
        } catch (error) {
            logger.error('Error in showFAQ:', error);
            await ctx.reply('❌ خطا در نمایش سوالات متداول');
        }
    }
}
