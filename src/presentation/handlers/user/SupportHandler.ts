import { Context } from 'grammy';
import { getSupportMenuKeyboard } from '../../keyboards/userKeyboards';


export class SupportHandler {
    /**
     * Show support menu
     */
    async showSupport(ctx: Context) {
        await ctx.reply(
            `💬 **پشتیبانی آنلاین**\n\n` +
            `برای ارتباط با پشتیبانی یا مشاهده سوالات متداول، از گزینه‌های زیر استفاده کنید.\n\n` +
            `📞 ساعات پاسخگویی: ۱۰ صبح تا ۱۰ شب`,
            {
                parse_mode: 'Markdown',
                reply_markup: getSupportMenuKeyboard(),
            }
        );
    }

    /**
     * Show contact info
     */
    async showContactInfo(ctx: Context) {
        // In a real app, these should be in config
        // const supportId = config.ADMIN_CHAT_ID;

        await ctx.reply(
            `📞 **اطلاعات تماس**\n\n` +
            `ایمیل: support@webot.com\n` +
            `کانال اطلاع‌رسانی: @WeBotChannel\n\n` +
            `برای ارسال پیام مستقیم به ادمین، از دکمه "ارسال تیکت" استفاده کنید.`
        );
    }

    /**
     * Show FAQ
     */
    async showFAQ(ctx: Context) {
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
    }
}
