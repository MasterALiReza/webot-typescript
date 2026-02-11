import { Context } from 'grammy';
// import { config } from '../../../shared/config';
import { logger } from '../../../shared/logger';

/**
 * PaymentSettingsHandler - Configure payment methods
 */
export class PaymentSettingsHandler {
    /**
     * Handle admin:payments - Show payment settings menu
     */
    static async handlePaymentsMenu(ctx: Context): Promise<void> {
        try {
            const message = `
💳 <b>تنظیمات پرداخت</b>

⚙️ <b>درگاه‌های فعال:</b>

${this.getPaymentMethodsStatus()}

📝 <b>راهنما:</b>
برای تغییر تنظیمات درگاه‌های پرداخت، فایل <code>.env</code> را ویرایش کنید:

<b>کارت به کارت:</b>
<code>CARD_NUMBER=6037...</code>
<code>CARD_HOLDER_NAME=نام دارنده کارت</code>

<b>زرین‌پال:</b>
<code>ZARINPAL_MERCHANT_ID=xxxxxxxx</code>
<code>ZARINPAL_SANDBOX=false</code>

<b>NowPayments (کریپتو):</b>
<code>NOWPAYMENTS_API_KEY=your-api-key</code>

🔮 <b>ویژگی آینده:</b>
مدیریت تنظیمات پرداخت از طریق پنل ادمین.
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '💳 کارت به کارت', callback_data: 'admin:payment:card' },
                    ], [
                        { text: '🏦 زرین‌پال', callback_data: 'admin:payment:zarinpal' },
                    ], [
                        { text: '₿ کریپتو (NowPayments)', callback_data: 'admin:payment:crypto' },
                    ], [
                        { text: '🔙 بازگشت', callback_data: 'admin:menu' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing payments menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:payment:card - Card to card settings
     */
    static async handleCardSettings(ctx: Context): Promise<void> {
        try {
            const cardNumber = process.env.CARD_NUMBER || 'تنظیم نشده';
            const cardHolder = process.env.CARD_HOLDER_NAME || 'تنظیم نشده';

            const message = `
💳 <b>تنظیمات کارت به کارت</b>

💳 <b>شماره کارت:</b> <code>${cardNumber}</code>
👤 <b>نام دارنده:</b> ${cardHolder}

برای تغییر، این متغیرها را در <code>.env</code> تنظیم کنید:
<code>CARD_NUMBER=6037997...</code>
<code>CARD_HOLDER_NAME=علی احمدی</code>
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: 'admin:payments' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing card settings:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:payment:zarinpal - Zarinpal settings
     */
    static async handleZarinpalSettings(ctx: Context): Promise<void> {
        try {
            const merchantId = process.env.ZARINPAL_MERCHANT_ID || 'تنظیم نشده';
            const sandbox = process.env.ZARINPAL_SANDBOX === 'true';

            const message = `
🏦 <b>تنظیمات زرین‌پال</b>

🔑 <b>Merchant ID:</b> <code>${merchantId}</code>
🧪 <b>حالت Sandbox:</b> ${sandbox ? 'فعال ✅' : 'غیرفعال ❌'}

برای تغییر، این متغیرها را در <code>.env</code> تنظیم کنید:
<code>ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx</code>
<code>ZARINPAL_SANDBOX=false</code>
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: 'admin:payments' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing zarinpal settings:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:payment:crypto - NowPayments settings
     */
    static async handleCryptoSettings(ctx: Context): Promise<void> {
        try {
            const apiKey = process.env.NOWPAYMENTS_API_KEY;
            const status = apiKey ? 'تنظیم شده ✅' : 'تنظیم نشده ❌';

            const message = `
₿ <b>تنظیمات NowPayments (کریپتو)</b>

🔑 <b>API Key:</b> ${status}

برای تغییر، این متغیر را در <code>.env</code> تنظیم کنید:
<code>NOWPAYMENTS_API_KEY=your-api-key</code>

<b>ارزهای پشتیبانی شده:</b>
• Bitcoin (BTC)
• Ethereum (ETH)
• Tether (USDT)
• و بیش از 150 ارز دیگر
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: 'admin:payments' },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing crypto settings:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Get payment methods status summary
     */
    private static getPaymentMethodsStatus(): string {
        const methods: string[] = [];

        if (process.env.CARD_NUMBER) {
            methods.push('✅ کارت به کارت');
        } else {
            methods.push('❌ کارت به کارت');
        }

        if (process.env.ZARINPAL_MERCHANT_ID) {
            methods.push('✅ زرین‌پال');
        } else {
            methods.push('❌ زرین‌پال');
        }

        if (process.env.NOWPAYMENTS_API_KEY) {
            methods.push('✅ NowPayments');
        } else {
            methods.push('❌ NowPayments');
        }

        return methods.join('\n');
    }
}
