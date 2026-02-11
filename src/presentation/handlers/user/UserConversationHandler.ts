
import { Context } from 'grammy';
import { WalletHandler } from './WalletHandler';
import { logger } from '../../../shared/logger';

export enum UserState {
    IDLE = 'IDLE',
    WAITING_PAYMENT_AMOUNT = 'WAITING_PAYMENT_AMOUNT',
    WAITING_DISCOUNT_CODE = 'WAITING_DISCOUNT_CODE',
    WAITING_TICKET_MESSAGE = 'WAITING_TICKET_MESSAGE',
}

interface UserSession {
    state: UserState;
    data: any;
}

const userSessions = new Map<number, UserSession>();

export class UserConversationHandler {
    private static walletHandler = new WalletHandler();

    static getSession(userId: number): UserSession {
        if (!userSessions.has(userId)) {
            userSessions.set(userId, { state: UserState.IDLE, data: {} });
        }
        return userSessions.get(userId)!;
    }

    static setState(userId: number, state: UserState, data: any = {}) {
        const session = this.getSession(userId);
        session.state = state;
        session.data = { ...session.data, ...data };
    }

    static clearSession(userId: number) {
        userSessions.set(userId, { state: UserState.IDLE, data: {} });
    }

    static async handleMessage(ctx: Context, next: () => Promise<void>): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const session = this.getSession(userId);

        if (session.state === UserState.IDLE) {
            return next();
        }

        try {
            switch (session.state) {
                case UserState.WAITING_PAYMENT_AMOUNT:
                    const amount = Number(ctx.message?.text);
                    if (isNaN(amount) || amount < 1000) {
                        await ctx.reply('❌ لطفاً یک مبلغ معتبر (حداقل ۱۰۰۰ تومان) وارد کنید.');
                        return;
                    }

                    await this.walletHandler.processPaymentAmount(ctx, amount);
                    this.clearSession(userId);
                    break;

                case UserState.WAITING_DISCOUNT_CODE:
                    const code = ctx.message?.text;
                    if (!code) return;

                    const productId = session.data.productId;
                    if (!productId) {
                        await ctx.reply('❌ خطایی رخ داد. لطفاً فرآیند خرید را مجدداً آغاز کنید.');
                        this.clearSession(userId);
                        return;
                    }

                    const { DiscountHandler } = require('../admin/DiscountHandler');
                    const discountResult = await DiscountHandler.applyDiscount(code, userId);

                    if (discountResult.valid) {
                        // Valid discount
                        session.data.discount = {
                            percent: discountResult.discountPercent,
                            codeId: discountResult.codeId,
                            code: code
                        };

                        await ctx.reply(discountResult.message);

                        // Refresh purchase confirmation
                        const { PurchaseHandler } = require('./PurchaseHandler');
                        const purchaseHandler = new PurchaseHandler();
                        await purchaseHandler.confirmPurchase(ctx, productId, userId);
                    } else {
                        await ctx.reply(discountResult.message);
                    }
                    session.state = UserState.IDLE;
                    break;

                case UserState.WAITING_TICKET_MESSAGE:
                    const ticketMessage = ctx.message?.text;
                    if (!ticketMessage) {
                        await ctx.reply('❌ لطفاً متن پیام خود را ارسال کنید.');
                        return;
                    }

                    // Save ticket to DB
                    // We need Prisma client here. 
                    // Importing prisma directly or using a repository?
                    // Let's use prisma directly for simplicity in this handler as we did in others, 
                    // or import UserRepository if it had ticket methods (it doesn't).
                    // I will import prisma from infrastructure.
                    const { prisma } = require('../../../infrastructure/database/prisma');

                    // We need user DB ID, not telegram ID.
                    // session.data should probably store user DB ID if possible, 
                    // or we fetch user by chatId.
                    const user = await prisma.user.findUnique({ where: { chatId: BigInt(userId) } });

                    if (!user) {
                        await ctx.reply('❌ کاربر یافت نشد.');
                        this.clearSession(userId);
                        return;
                    }

                    const ticket = await prisma.supportTicket.create({
                        data: {
                            userId: user.id,
                            message: ticketMessage,
                            status: 'OPEN'
                        }
                    });

                    await ctx.reply(`✅ تیکت شما با موفقیت ثبت شد.\nشماره تیکت: #${ticket.id}\n\nهمکاران ما به زودی پاسخ خواهند داد.`);

                    // Notify Admins
                    // Need a way to get admin chat IDs.
                    const admins = await prisma.admin.findMany();
                    for (const admin of admins) {
                        try {
                            await ctx.api.sendMessage(
                                Number(admin.chatId),
                                `📨 <b>تیکت جدید</b>\n\n👤 کاربر: ${user.firstName || 'ناشناس'} (${user.chatId})\n📝 متن: ${ticketMessage}\n\n#Ticket_${ticket.id}`,
                                {
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        inline_keyboard: [[{ text: 'پاسخ دادن', callback_data: `admin:ticket:reply:${ticket.id}` }]]
                                    }
                                }
                            );
                        } catch (e) {
                            console.error('Failed to notify admin', e);
                        }
                    }

                    this.clearSession(userId);
                    break;

                default:
                    return next();
            }
        } catch (error) {
            logger.error(`Error in user conversation handler for state ${session.state}:`, error);
            await ctx.reply('❌ خطایی رخ داد. عملیات لغو شد.');
            this.clearSession(userId);
        }
    }
}
