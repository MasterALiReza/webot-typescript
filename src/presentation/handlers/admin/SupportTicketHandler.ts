
import { Context, InlineKeyboard } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/logger';
import { AdminConversationHandler, AdminState } from './AdminConversationHandler';

export class SupportTicketHandler {
    /**
     * Handle admin:tickets - Show tickets menu
     */
    static async handleTicketsMenu(ctx: Context) {
        try {
            const openCount = await prisma.supportTicket.count({ where: { status: 'OPEN' } });
            const totalCount = await prisma.supportTicket.count();

            const message = `
🎫 <b>مدیریت تیکت‌های پشتیبانی</b>

📥 <b>تیکت‌های باز:</b> ${openCount}
🗂 <b>کل تیکت‌ها:</b> ${totalCount}

برای مشاهده و پاسخ به تیکت‌ها از گزینه‌های زیر استفاده کنید.
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `📥 تیکت‌های باز (${openCount})`, callback_data: 'admin:tickets:open' }],
                        [{ text: '🔙 بازگشت', callback_data: 'admin:menu' }]
                    ]
                }
            });
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing tickets menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:tickets:open - List open tickets
     */
    static async handleListOpen(ctx: Context) {
        try {
            const tickets = await prisma.supportTicket.findMany({
                where: { status: 'OPEN' },
                include: { user: true },
                orderBy: { createdAt: 'asc' }, // Oldest first
                take: 10
            });

            if (tickets.length === 0) {
                await ctx.answerCallbackQuery({ text: '✅ هیچ تیکت بازی وجود ندارد!' });
                return;
            }

            const keyboard = new InlineKeyboard();
            tickets.forEach(t => {
                const user = t.user.firstName || t.user.username || 'User';
                keyboard.text(`Ticket #${t.id} - ${user}`, `admin:ticket:view:${t.id}`).row();
            });
            keyboard.text('🔙 بازگشت', 'admin:tickets');

            await ctx.editMessageText('📥 <b>لیست تیکت‌های باز:</b>\n\nبرای مشاهده جزئیات و پاسخ، روی تیکت کلیک کنید.', {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error listing open tickets:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:ticket:view:{id} - View specific ticket
     */
    static async handleViewTicket(ctx: Context, ticketId: number) {
        try {
            const ticket = await prisma.supportTicket.findUnique({
                where: { id: ticketId },
                include: { user: true }
            });

            if (!ticket) {
                await ctx.answerCallbackQuery({ text: '❌ تیکت یافت نشد.' });
                return;
            }

            const userLink = `<a href="tg://user?id=${ticket.user.chatId}">${ticket.user.firstName || 'User'}</a>`;
            const date = ticket.createdAt.toLocaleString('fa-IR');

            const message = `
🎫 <b>جزئیات تیکت #${ticket.id}</b>

👤 <b>کاربر:</b> ${userLink} (<code>${ticket.user.chatId}</code>)
📅 <b>تاریخ:</b> ${date}
📊 <b>وضعیت:</b> ${ticket.status}

📝 <b>متن پیام:</b>
${ticket.message}
            `.trim();

            const keyboard = new InlineKeyboard();
            if (ticket.status === 'OPEN') {
                keyboard.text('✍️ پاسخ دادن', `admin:ticket:reply:${ticket.id}`).row();
                keyboard.text('🔒 بستن تیکت', `admin:ticket:close:${ticket.id}`).row();
            }
            keyboard.text('🔙 بازگشت', 'admin:tickets:open');

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error viewing ticket:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:ticket:close:{id}
     */
    static async handleCloseTicket(ctx: Context, ticketId: number) {
        try {
            await prisma.supportTicket.update({
                where: { id: ticketId },
                data: { status: 'CLOSED' }
            });

            await ctx.answerCallbackQuery({ text: '✅ تیکت بسته شد.' });
            await this.handleListOpen(ctx); // Refresh list
        } catch (error) {
            logger.error('Error closing ticket:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:ticket:reply:{id} - Initiate reply flow
     */
    static async handleReplyTicket(ctx: Context, ticketId: number) {
        if (!ctx.from) return;

        const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) {
            await ctx.answerCallbackQuery({ text: '❌ تیکت یافت نشد.' });
            return;
        }

        AdminConversationHandler.setState(ctx.from.id, AdminState.WAITING_TICKET_REPLY, {
            ticketId: ticket.id,
            userId: ticket.userId
        });

        await ctx.reply(`✍️ لطفاً پاسخ خود را برای تیکت #${ticket.id} ارسال کنید:`, {
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 لغو', callback_data: 'admin:tickets:open' }]]
            }
        });
        await ctx.answerCallbackQuery();
    }
}
