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

            const balance = user.balance.toString();

            let message = `💰 کیف پول من\n\n`;
            message += `👤 کاربر: ${user.firstName || 'کاربر'}\n`;
            message += `📱 شماره تماس: ${user.phoneNumber || 'ثبت نشده'}\n\n`;
            message += `💳 موجودی فعلی: ${parseInt(balance).toLocaleString()} تومان\n\n`;
            message += `🔹 جهت افزایش موجودی از دکمه‌های زیر استفاده کنید.`;

            await ctx.reply(message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '➕ افزایش موجودی', callback_data: 'wallet_deposit' },
                            { text: '📋 تراکنش‌های من', callback_data: 'wallet_transactions' }
                        ],
                        [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'main_menu' }]
                    ]
                }
            });

        } catch (error) {
            logger.error('Error in showWallet:', error);
            await ctx.reply('❌ خطایی رخ داد. لطفا دوباره تلاش کنید.');
        }
    }

    async handleCallback(ctx: Context) {
        try {
            if (!ctx.callbackQuery?.data) return;

            const data = ctx.callbackQuery.data;

            if (data === 'wallet_deposit') {
                await this.startDepositFlow(ctx);
            } else if (data === 'wallet_transactions') {
                await this.showTransactions(ctx);
            } else if (data.startsWith('deposit_amount_')) {
                const amount = parseInt(data.replace('deposit_amount_', ''));
                await this.confirmDepositAmount(ctx, amount);
            } else if (data.startsWith('deposit_gateway_')) {
                const parts = data.split('_'); // deposit_gateway_zarinpal_50000
                const gateway = parts[2];
                const amount = parseInt(parts[3]);
                await this.createPaymentLink(ctx, gateway, amount);
            }

            await ctx.answerCallbackQuery();

        } catch (error) {
            logger.error('Error in wallet handleCallback:', error);
        }
    }

    async startDepositFlow(ctx: Context) {
        try {
            const amounts = [50000, 100000, 200000, 500000];
            const keyboard = [];

            // Chunk amounts into rows of 2
            for (let i = 0; i < amounts.length; i += 2) {
                const row = amounts.slice(i, i + 2).map(amount => ({
                    text: `${amount.toLocaleString()} تومان`,
                    callback_data: `deposit_amount_${amount}`
                }));
                keyboard.push(row);
            }

            // Add custom amount button
            keyboard.push([{ text: '✏️ مبلغ دلخواه', callback_data: 'deposit_custom_amount' }]);
            keyboard.push([{ text: '🔙 بازگشت', callback_data: 'wallet_main' }]);

            await ctx.editMessageText('💳 لطفا مبلغ افزایش اعتبار را انتخاب کنید:', {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            logger.error('Error in startDepositFlow:', error);
            await ctx.reply('❌ خطایی رخ داد.');
        }
    }

    async processPaymentAmount(ctx: Context, amount: number) {
        if (amount < 1000) {
            await ctx.reply('❌ حداقل مبلغ قابل پرداخت ۱,۰۰۰ تومان است.');
            return;
        }
        await this.confirmDepositAmount(ctx, amount);
    }

    async confirmDepositAmount(ctx: Context, amount: number) {
        try {
            const gateways = [];
            const settings = await prisma.botSetting.findFirst();

            if (settings?.nowPaymentsEnabled) {
                gateways.push({ text: '💎 NowPayments (Crypto)', callback_data: `deposit_gateway_nowpayments_${amount}` });
            }
            if (config.ZARINPAL_MERCHANT_ID) {
                gateways.push({ text: '💳 زرین‌پال', callback_data: `deposit_gateway_zarinpal_${amount}` });
            }
            if (settings?.cardToCardEnabled) {
                gateways.push({ text: '💳 کارت به کارت', callback_data: `deposit_gateway_card_${amount}` });
            }

            gateways.push({ text: '🔙 بازگشت', callback_data: 'wallet_deposit' });

            // Structure keyboard
            const keyboard = gateways.map(g => [g]);

            await ctx.editMessageText(`💰 مبلغ قابل پرداخت: ${amount.toLocaleString()} تومان\n\n👇 لطفا درگاه پرداخت را انتخاب کنید:`, {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            logger.error('Error in confirmDepositAmount:', error);
        }
    }

    async createPaymentLink(ctx: Context, method: string, amount: number) {
        try {
            if (!ctx.from) return;

            if (method === 'card') {
                return await this.handleCardToCard(ctx, amount);
            }

            const user = await userRepo.findByChatId(BigInt(ctx.from.id));
            if (!user) return;

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
                    description: `افزایش اعتبار کیف پول - ${method}`
                }
            });

            await ctx.editMessageText(`🔗 لینک پرداخت ایجاد شد.\n\n💰 مبلغ: ${amount.toLocaleString()} تومان\n\n👇 جهت پرداخت روی لینک زیر کلیک کنید:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 پرداخت آنلاین', url: paymentUrl }],
                        [{ text: '🔙 بازگشت', callback_data: 'wallet_main' }]
                    ]
                }
            });

        } catch (error) {
            logger.error('Error in createPaymentLink:', error);
            await ctx.reply('❌ خطا در ایجاد لینک پرداخت.');
        }
    }

    async handleCardToCard(ctx: Context, amount: number) {
        try {
            const settings = await prisma.botSetting.findFirst();
            const cardNumber = settings?.cardNumber;
            const cardOwner = config.CARD_OWNER || ''; // From env or settings if available

            if (!cardNumber) {
                return ctx.reply('❌ شماره کارت تنظیم نشده است.');
            }

            // Start User Custom Flow for Card to Card
            // This requires state management (e.g. asking for receipt)
            // simplified:
            await ctx.editMessageText(`💳 پرداخت کارت به کارت\n\nمبلغ: ${amount.toLocaleString()} تومان\n\nشماره کارت:\n\`${cardNumber}\`\n\n${cardOwner ? `👤 به نام: ${cardOwner}\n\n` : ''}لطفا مبلغ را واریز کرده و عکس فیش را ارسال کنید.`, {
                parse_mode: 'Markdown'
            });

            // Implicitly we'd set user state here to WAITING_FOR_RECEIPT
            const userId = ctx.from?.id;
            if (userId) {
                UserConversationHandler.setState(userId, UserState.WAITING_FOR_PAYMENT_PROOF, { amount });
            }

        } catch (error) {
            logger.error('Error in handleCardToCard:', error);
        }
    }

    async showTransactions(ctx: Context) {
        try {
            if (!ctx.from) return;

            const user = await userRepo.findByChatId(BigInt(ctx.from.id));
            if (!user) return;

            const transactions = await prisma.paymentReport.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            if (transactions.length === 0) {
                await ctx.editMessageText('📭 لیست تراکنش‌های شما خالی است.', {
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'wallet_main' }]]
                    }
                });
                return;
            }

            let message = '📋 آخرین تراکنش‌های شما:\n\n';

            transactions.forEach(t => {
                const statusEmoji = t.status === 'PAID' ? '✅' : (t.status === 'PENDING' ? '⏳' : '❌');
                const date = t.createdAt.toLocaleDateString('fa-IR');
                message += `${statusEmoji} ${parseInt(t.amount.toString()).toLocaleString()} تومان\n📅 ${date} - ${t.method}\n\n`;
            });

            await ctx.editMessageText(message, {
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'wallet_main' }]]
                }
            });

        } catch (error) {
            logger.error('Error in showTransactions:', error);
        }
    }
}
