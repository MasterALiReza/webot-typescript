import { Context } from 'grammy';
import { logger } from '../../../shared/logger';

/**
 * TextCustomizationHandler - Customize bot messages
 * Note: This is a placeholder for future database-based text management
 */
export class TextCustomizationHandler {
    /**
     * Handle admin:texts - Show text customization menu
     */
    static async handleTextsMenu(ctx: Context): Promise<void> {
        try {
            const message = `
✏️ <b>مدیریت متون ربات</b>

📝 <b>متون قابل تنظیم:</b>

• پیام خوش‌آمدگویی
• پیام ایجاد سرویس
• پیام انقضای سرویس
• پیام کمبود حجم
• دستورالعمل پرداخت
• پیام راهنما

⚙️ <b>وضعیت فعلی:</b>
متون ربات در کد hardcode شده‌اند.

🔮 <b>ویژگی آینده:</b>
• ذخیره متون در پایگاه داده
• ویرایش آنلاین از طریق پنل
• پشتیبانی از متغیرها: {username}, {service}, {days}
• بازگشت به متن پیش‌فرض
• پیش‌نمایش قبل از ذخیره

📋 <b>متن‌های پیشنهادی برای سفارشی‌سازی:</b>

1️⃣ <b>خوش‌آمدگویی:</b>
<code>سلام {username}عزیز! به ربات ما خوش آمدید.</code>

2️⃣ <b>سرویس ایجاد شد:</b>
<code>سرویس شما با موفقیت ایجاد شد.
نام کاربری: {username}
حجم: {volume} GB
مدت: {duration} روز</code>

3️⃣ <b>هشدار انقضا:</b>
<code>⚠️ سرویس شما {days} روز دیگر منقضی می‌شود.</code>

برای پیاده‌سازی این ویژگی، به جدول <code>TextTemplate</code> در پایگاه داده نیاز است.
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: 'admin:menu' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing texts menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Get default text templates
     */
    static getDefaultTexts(): Record<string, string> {
        return {
            welcome: 'سلام {username} عزیز!\n\nبه ربات ما خوش آمدید. 🌟',

            serviceCreated: `✅ سرویس شما با موفقیت ایجاد شد!

نام کاربری: {username}
حجم: {volume} GB
مدت: {duration} روز
پنل: {panel}

لینک اتصال: {link}`,

            expiryWarning: '⚠️ سرویس شما {days} روز دیگر منقضی می‌شود.\n\nبرای تمدید از منوی اصلی اقدام کنید.',

            volumeWarning: '⚠️ حجم باقیمانده شما: {remaining} GB\n\nلطفاً برای تمدید اقدام کنید.',

            paymentInstructions: `💳 دستورالعمل پرداخت:

مبلغ: {amount} تومان

شماره کارت: {cardNumber}
به نام: {cardHolder}

پس از واریز، رسید را ارسال کنید.`,

            helpText: `📚 راهنمای استفاده:

/start - شروع و ثبت‌نام
/buy - خرید سرویس
/services - سرویس‌های من
/wallet - کیف پول
/support - پشتیبانی

برای سوالات بیشتر با پشتیبانی تماس بگیرید.`,
        };
    }

    /**
     * Replace variables in text template
     */
    static replaceVariables(
        template: string,
        variables: Record<string, string | number>
    ): string {
        let text = template;

        for (const [key, value] of Object.entries(variables)) {
            text = text.replace(new RegExp(`{${key}}`, 'g'), String(value));
        }

        return text;
    }
}
