import { Context } from 'grammy';
import { UserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { PaymentFactory, PaymentMethod } from '../../../infrastructure/payments/PaymentFactory';
import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/logger';

const userRepo = new UserRepository();

export class PaymentHandler {
    /**
     * Show payment methods to user
     */
    async showPaymentMethods(ctx: Context, amount: number) {
        if (!ctx.from) return;

        const methods = PaymentFactory.getAvailableMethods();

        let message = `💳 <b>انتخاب روش پرداخت</b>\n\n`;
        message += `مبلغ قابل پرداخت: <b>${amount.toLocaleString('fa-IR')} تومان</b>\n\n`;
        message += `لطفاً یکی از روش‌های پرداخت زیر را انتخاب کنید:`;

        const keyboard = {
            inline_keyboard: [] as any[][],
        };

        if (methods.includes('zarinpal')) {
            keyboard.inline_keyboard.push([
                { text: '🟢 زرین‌پال (کارت بانکی)', callback_data: `pay:zarinpal:${amount}` },
            ]);
        }

        if (methods.includes('nowpayments')) {
            keyboard.inline_keyboard.push([
                { text: '₿ پرداخت رمزارز', callback_data: `pay:nowpayments:${amount}` },
            ]);
        }

        if (methods.includes('cardtocard')) {
            keyboard.inline_keyboard.push([
                { text: '💳 کارت به کارت', callback_data: `pay:cardtocard:${amount}` },
            ]);
        }

        keyboard.inline_keyboard.push([{ text: '🔙 بازگشت', callback_data: 'wallet' }]);

        await ctx.reply(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });
    }

    /**
     * Process payment request
     */
    async processPayment(ctx: Context, method: PaymentMethod, amount: number) {
        if (!ctx.from) return;

        const user = await userRepo.findByChatId(BigInt(ctx.from.id));
        if (!user) return;

        try {
            const gateway = PaymentFactory.create(method);

            const { paymentUrl, trackingCode } = await gateway.createPayment(
                amount,
                user.id,
                { mobile: ctx.from.username }
            );

            // Save payment record with unique orderId
            const orderId = `PAY_${user.id}_${Date.now()}`;

            await prisma.paymentReport.create({
                data: {
                    userId: user.id,
                    orderId,
                    amount,
                    method: method.toUpperCase().replace('CARDTOCARD', 'CARD_TO_CARD') as any,
                    transactionId: trackingCode,
                    status: 'PENDING',
                },
            });

            // Send payment instructions based on method
            if (method === 'cardtocard') {
                const cardInfo = JSON.parse(paymentUrl);
                let message = `💳 <b>پرداخت کارت به کارت</b>\n\n`;
                message += `مبلغ: <b>${cardInfo.amount} تومان</b>\n\n`;
                message += `🏦 شماره کارت:\n<code>${cardInfo.cardNumber}</code>\n\n`;
                message += `👤 به نام: ${cardInfo.cardHolder}\n\n`;
                message += `📌 کد پیگیری: <code>${cardInfo.trackingCode}</code>\n\n`;
                message += `⚠️ <b>مهم:</b>\n`;
                message += `بعد از واریز، عکس رسید را ارسال کنید تا موجودی شما شارژ شود.`;

                await ctx.editMessageText(message, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📤 ارسال رسید', callback_data: `upload_receipt:${trackingCode}` }],
                            [{ text: '🔙 بازگشت', callback_data: 'wallet' }],
                        ],
                    },
                });
            } else {
                let message = `✅ درخواست پرداخت ایجاد شد\n\n`;
                message += `💰 مبلغ: <b>${amount.toLocaleString('fa-IR')} تومان</b>\n`;
                message += `📌 کد پیگیری: <code>${trackingCode}</code>\n\n`;

                if (method === 'zarinpal') {
                    message += `برای تکمیل پرداخت، روی دکمه زیر کلیک کنید:`;
                } else if (method === 'nowpayments') {
                    message += `آدرس wallet برای واریز:\n<code>${paymentUrl}</code>\n\n`;
                    message += `پس از واریز، وضعیت پرداخت بررسی می‌شود.`;
                }

                const keyboard: any = {
                    inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'wallet' }]],
                };

                if (method === 'zarinpal') {
                    keyboard.inline_keyboard.unshift([
                        { text: '💳 پرداخت', url: paymentUrl },
                    ]);
                }

                await ctx.editMessageText(message, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                });
            }

            await ctx.answerCallbackQuery();
        } catch (error: any) {
            logger.error('Payment error:', error);
            await ctx.answerCallbackQuery({ text: 'خطا در ایجاد پرداخت!' });
        }
    }

    /**
     * Handle receipt upload for card-to-card
     */
    async handleReceiptUpload(ctx: Context, trackingCode: string) {
        if (!ctx.message?.photo || !ctx.from) return;

        const user = await userRepo.findByChatId(BigInt(ctx.from.id));
        if (!user) return;

        try {
            // Get the largest photo
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const fileId = photo.file_id;

            // Update payment report with receipt photo (photoId field in schema)
            await prisma.paymentReport.updateMany({
                where: {
                    transactionId: trackingCode,
                    userId: user.id,
                },
                data: {
                    photoId: fileId,
                },
            });

            let message = `✅ رسید شما دریافت شد\n\n`;
            message += `📌 کد پیگیری: <code>${trackingCode}</code>\n\n`;
            message += `رسید شما در حال بررسی است.\n`;
            message += `پس از تأیید، موجودی شما شارژ می‌شود.`;

            await ctx.reply(message, { parse_mode: 'HTML' });
        } catch (error: any) {
            logger.error('Receipt upload error:', error);
            await ctx.reply('❌ خطا در آپلود رسید');
        }
    }
}
