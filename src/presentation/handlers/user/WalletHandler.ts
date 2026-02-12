import { Context } from 'grammy';
import { PaymentMethod } from '@prisma/client';
import { UserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { loadConfig } from '../../../shared/config';
import { logger } from '../../../shared/logger';
import { PaymentFactory } from '../../../infrastructure/payments/PaymentFactory';
import { prisma } from '../../../infrastructure/database/prisma';
import { UserConversationHandler, UserState } from './UserConversationHandler';

const config = loadConfig();

const userRepo = new UserRepository();

export class WalletHandler {
    async showWallet(ctx: Context) {
        try {
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
        } catch (error) {
            logger.error('Error in showWallet:', error);
            await ctx.reply('❌ خطایی در نمایش کیف پول رخ داد.');
        }
    }

    async showCardToCard(ctx: Context) {
        try {
            if (!ctx.callbackQuery) return;

            const cardNumber = config.CARD_NUMBER || 'تنظیم نشده';
            const cardOwner = config.CARD_OWNER || 'تنظیم نشده';

            let message = `💳 <b>شارژ کیف پول - کارت به کارت</b>\n\n`;
            message += `لطفاً مبلغ مورد نظر را به شماره کارت زیر واریز کنید:\n\n`;
            message += `🏦 شماره کارت:\n<code>${cardNumber}</code>\n\n`;
            message += `📝 نام دارنده: ${cardOwner}\n\n`;
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
        } catch (error) {
            logger.error('Error in showCardToCard:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا در نمایش اطلاعات کارت' });
        }
    }

    async handleOnlinePayment(ctx: Context) {
        try {
            const userId = ctx.from?.id;
            if (!userId) return;

            UserConversationHandler.setState(userId, UserState.WAITING_PAYMENT_AMOUNT);

            await ctx.editMessageText(
                '💳 <b>افزایش موجودی آنلاین</b>\n\n' +
                'لطفاً مبلغ مورد نظر را به تومان وارد کنید:\n' +
                '(حداقل ۱۰۰۰ تومان)',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 بازگشت', callback_data: 'wallet' }],
                        ],
                    },
                }
            );
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in handleOnlinePayment:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    async processPaymentAmount(ctx: Context, amount: number) {
        try {
            const userId = ctx.from?.id;
            if (!userId) return;

            // Validation: Check amount bounds
            const MIN_AMOUNT = 1000;
            const MAX_AMOUNT = 100000000; // 100 million toman

            if (amount < MIN_AMOUNT) {
                await ctx.reply(`❌ حداقل مبلغ قابل پرداخت ${MIN_AMOUNT.toLocaleString('fa-IR')} تومان است.`);
                return;
            }

            if (amount > MAX_AMOUNT) {
                await ctx.reply(`❌ حداکثر مبلغ قابل پرداخت ${MAX_AMOUNT.toLocaleString('fa-IR')} تومان است.`);
                return;
            }

            const user = await userRepo.findByChatId(BigInt(userId));
            if (!user) return;

            await ctx.reply('⏳ در حال ایجاد لینک پرداخت...');

            // Create Payment Gateway
            // Default to Zarinpal if configured, else try others.
            //Ideally we should let user choose if multiple are available.
            // For now, simple logic: use Zarinpal if ID exists.
            const methods = PaymentFactory.getAvailableMethods();
            let method = 'cardtocard';
            if (methods.includes('zarinpal')) method = 'zarinpal';
            else if (methods.includes('nowpayments')) method = 'nowpayments';

            if (method === 'cardtocard') {
                await ctx.reply('❌ درگاه پرداخت آنلاین فعال نیست.');
                return;
            }

            const gateway = PaymentFactory.create(method as any);

            // Create Payment Request
            const { paymentUrl, trackingCode } = await gateway.createPayment(amount, user.id, {
                mobile: user.phoneNumber,
                email: ''
            });

            // Save Pending Report
            await prisma.paymentReport.create({
                data: {
                    userId: user.id,
                    amount: amount,
                    method: (method === 'zarinpal' ? PaymentMethod.ZARINPAL : PaymentMethod.NOWPAYMENTS),
                    status: 'PENDING',
                    transactionId: trackingCode,
                    orderId: trackingCode, // unique constraint
                    description: `درخواست شارژ آنلاین - ${method}`
                }
            });

            await ctx.reply(
                `💳 <b>فاکتور پرداخت</b>\n\n` +
                `💰 مبلغ: ${amount.toLocaleString('fa-IR')} تومان\n\n` +
                `برای پرداخت روی دکمه زیر کلیک کنید:`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔗 پرداخت آنلاین', url: paymentUrl }],
                            [{ text: '🔙 بازگشت به کیف پول', callback_data: 'wallet' }]
                        ]
                    }
                }
            );

        } catch (error) {
            logger.error('Error in processPaymentAmount:', error);
            await ctx.reply('❌ خطا در ایجاد لینک پرداخت. لطفاً بعداً تلاش کنید.');
        }
    }

    async handleSendReceipt(ctx: Context) {
        try {
            await ctx.editMessageText(
                '📸 لطفاً تصویر رسید واریزی خود را ارسال کنید.\n\n' +
                'در کپشن تصویر می‌توانید توضیحات اضافی بنویسید.',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 بازگشت', callback_data: 'wallet' }],
                        ],
                    },
                }
            );
            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in handleSendReceipt:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }
}
