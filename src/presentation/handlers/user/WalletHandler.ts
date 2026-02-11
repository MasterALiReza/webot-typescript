import { Context } from 'grammy';
import { UserRepository } from '../../../infrastructure/database/repositories/UserRepository';

const userRepo = new UserRepository();

export class WalletHandler {
    async showWallet(ctx: Context) {
        if (!ctx.from) return;

        const user = await userRepo.findByChatId(BigInt(ctx.from.id));
        if (!user) return;

        const balance = Number(user.balance);

        let message = `💰 <b>کیف پول شما</b>\n\n`;
        message += `💵 موجودی فعلی: <b>${balance.toLocaleString('fa-IR')} تومان</b>\n\n`;
        message += `🔗 لینک دعوت شما:\n`;
        message += `<code>https://t.me/${ctx.me.username}?start=ref_${user.refCode}</code>\n\n`;
        message += `👥 تعداد زیرمجموعه: ${user.affiliateCount} نفر\n`;
        message += `🎁 به ازای هر زیرمجموعه: 5,000 تومان\n\n`;
        message += `برای شارژ کیف پول، از دکمه‌های زیر استفاده کنید:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '💳 کارت به کارت', callback_data: 'charge:card' }],
                [{ text: '🌐 درگاه آنلاین', callback_data: 'charge:online' }],
                [{ text: '🔙 بازگشت', callback_data: 'main_menu' }],
            ],
        };

        await ctx.reply(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });
    }

    async showCardToCard(ctx: Context) {
        if (!ctx.callbackQuery) return;

        let message = `💳 <b>شارژ کیف پول - کارت به کارت</b>\n\n`;
        message += `لطفاً مبلغ مورد نظر را به شماره کارت زیر واریز کنید:\n\n`;
        message += `🏦 شماره کارت:\n<code>6037-9977-1234-5678</code>\n\n`;
        message += `📝 نام دارنده: علی احمدی\n\n`;
        message += `⚠️ توجه:\n`;
        message += `1️⃣ بعد از واریز، عکس رسید را ارسال کنید\n`;
        message += `2️⃣ موجودی شما پس از تأیید ادمین شارژ می‌شود\n`;
        message += `3️⃣ معمولاً ظرف 10-30 دقیقه تأیید می‌شود\n`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '📤 ارسال رسید', callback_data: 'send_receipt' }],
                [{ text: '🔙 بازگشت', callback_data: 'wallet' }],
            ],
        };

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });

        await ctx.answerCallbackQuery();
    }
}
