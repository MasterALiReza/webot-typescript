import { Context } from 'grammy';
import { ProductRepository } from '../../../infrastructure/database/repositories/ProductRepository';
import { UserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { PurchaseProductUseCase } from '../../../application/use-cases/PurchaseProduct';
import { InvoiceRepository } from '../../../infrastructure/database/repositories/InvoiceRepository';
import { InlineKeyboard } from 'grammy';

import { logger } from '../../../shared/logger';

const productRepo = new ProductRepository();
const userRepo = new UserRepository();
const invoiceRepo = new InvoiceRepository();

export class PurchaseHandler {
    async showProducts(ctx: Context) {
        try {
            if (!ctx.from) return;

            const products = await productRepo.findAllActive();

            if (products.length === 0) {
                await ctx.reply('⚠️ در حال حاضر محصولی موجود نیست.');
                return;
            }

            let message = '🛒 <b>محصولات موجود:</b>\n\n';
            const keyboard = new InlineKeyboard();

            for (const product of products) {
                message += `📦 <b>${product.name}</b>\n`;
                message += `💰 قیمت: ${product.price} تومان\n`;
                message += `📊 حجم: ${product.volume} GB\n`;
                message += `⏰ مدت: ${product.duration} روز\n`;
                if (product.description) {
                    message += `📝 ${product.description}\n`;
                }
                message += `\n`;

                keyboard.text(`خرید ${product.name}`, `buy:${product.id}`).row();
            }

            await ctx.reply(message, {
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });
        } catch (error) {
            logger.error('Error in showProducts:', error);
            await ctx.reply('❌ خطایی در نمایش محصولات رخ داد.');
        }
    }

    async confirmPurchase(ctx: Context, productId: number, userId?: number) {
        try {
            // userId might be passed from UserConversationHandler
            const targetUserId = userId || ctx.from?.id;
            if (!targetUserId) return;

            const user = await userRepo.findByChatId(BigInt(targetUserId));
            if (!user) {
                if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'خطا: کاربر یافت نشد' });
                return;
            }

            const product = await productRepo.findById(productId);
            if (!product) {
                if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'محصول یافت نشد' });
                return;
            }

            const { UserConversationHandler } = require('./UserConversationHandler');
            const session = UserConversationHandler.getSession(targetUserId);

            // Check for discount
            let price = Number(product.price);
            let discountAmount = 0;
            let finalPrice = price;
            let discountApplied = false;

            if (session.data.discount && session.data.discount.code) {
                // Verify if discount is applicable to this product (if we had product-specific codes)
                // For now, assume global.
                const percent = session.data.discount.percent;
                discountAmount = (price * percent) / 100;
                finalPrice = Math.max(0, price - discountAmount);
                discountApplied = true;
            }

            const balance = Number(user.balance);

            let message = `📦 <b>${product.name}</b>\n\n`;
            message += `💰 قیمت اصلی: ${price.toLocaleString('fa-IR')} تومان\n`;

            if (discountApplied) {
                message += `🎉 تخفیف: ${discountAmount.toLocaleString('fa-IR')} تومان (${session.data.discount.percent}%)\n`;
                message += `🏷 <b>قیمت نهایی: ${finalPrice.toLocaleString('fa-IR')} تومان</b>\n\n`;
            } else {
                message += `\n`; // Spacer
            }

            message += `📊 حجم: ${product.volume} GB\n`;
            message += `⏰ مدت: ${product.duration} روز\n\n`;
            message += `💵 موجودی شما: ${balance.toLocaleString('fa-IR')} تومان\n`;

            const keyboard = new InlineKeyboard();

            if (balance >= finalPrice) {
                if (finalPrice === 0) {
                    message += `\n✅ سرویس رایگان فعال می‌شود.\n\nآیا مطمئن هستید؟`;
                } else {
                    message += `\n✅ موجودی شما کافی است.\n\nآیا مطمئن هستید؟`;
                }

                keyboard
                    .text('✅ تأیید خرید', `confirm:${productId}`)
                    .text('❌ انصراف', 'cancel')
                    .row();
            } else {
                const needed = finalPrice - balance;
                message += `\n⚠️ موجودی شما کافی نیست.\nمبلغ مورد نیاز: ${needed.toLocaleString('fa-IR')} تومان`;
                keyboard.text('💰 شارژ کیف پول', 'charge_wallet').row();
                keyboard.text('❌ انصراف', 'cancel').row();
            }

            if (!discountApplied) {
                keyboard.text('🎟 کد تخفیف دارید؟', `add_discount:${productId}`).row();
            } else {
                keyboard.text('❌ حذف کد تخفیف', `remove_discount:${productId}`).row();
            }

            // If triggered by callback, edit. If by message (from Conversation), reply.
            // Actually ConfirmPurchase is usually triggered by `buy:ID` callback.
            // But UserConversationHandler calls it too.
            // We should use `editMessageText` if callback, `reply` if message?
            // But `UserConversationHandler` handles text message.
            if (ctx.callbackQuery) {
                await ctx.editMessageText(message, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                });
                await ctx.answerCallbackQuery();
            } else {
                await ctx.reply(message, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                });
            }

        } catch (error) {
            logger.error('Error in confirmPurchase:', error);
            if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '❌ خطا در تأیید خرید' });
        }
    }

    async handleAddDiscount(ctx: Context, productId: number) {
        const userId = ctx.from?.id;
        if (!userId) return;

        const { UserConversationHandler, UserState } = require('./UserConversationHandler');
        UserConversationHandler.setState(userId, UserState.WAITING_DISCOUNT_CODE, { productId });

        await ctx.editMessageText(
            '🎟 لطفاً <b>کد تخفیف</b> خود را ارسال کنید:',
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: `buy:${productId}` }]]
                }
            }
        );
        await ctx.answerCallbackQuery();
    }

    async handleRemoveDiscount(ctx: Context, productId: number) {
        const userId = ctx.from?.id;
        if (!userId) return;

        const { UserConversationHandler } = require('./UserConversationHandler');
        const session = UserConversationHandler.getSession(userId);

        if (session.data.discount) {
            delete session.data.discount;
        }

        await this.confirmPurchase(ctx, productId, userId);
        await ctx.answerCallbackQuery({ text: '✅ کد تخفیف حذف شد' });
    }

    async executePurchase(ctx: Context, productId: number) {
        try {
            if (!ctx.from || !ctx.callbackQuery) return;
            const userId = ctx.from.id;

            // Idempotency check: prevent double purchase

            // Check if there's already a pending purchase for this user
            const { UserConversationHandler } = require('./UserConversationHandler');
            const session = UserConversationHandler.getSession(userId);

            if (session.data.pendingPurchase) {
                await ctx.answerCallbackQuery({
                    text: '⚠️ درخواست قبلی شما در حال پردازش است. لطفاً صبر کنید.',
                    show_alert: true
                });
                return;
            }

            // Mark purchase as pending
            session.data.pendingPurchase = true;

            const user = await userRepo.findByChatId(BigInt(userId));
            if (!user) {
                delete session.data.pendingPurchase;
                await ctx.answerCallbackQuery({ text: 'خطا: کاربر یافت نشد' });
                return;
            }

            const product = await productRepo.findById(productId);
            if (!product) {
                delete session.data.pendingPurchase;
                await ctx.answerCallbackQuery({ text: 'محصول یافت نشد' });
                return;
            }

            // Calculate Final Price
            let price = Number(product.price);
            let discountAmount = 0;
            let finalPrice = price;
            let discountId: number | undefined;

            if (session.data.discount && session.data.discount.code) {
                const percent = session.data.discount.percent;
                discountAmount = (price * percent) / 100;
                finalPrice = Math.max(0, price - discountAmount);
                discountId = session.data.discount.codeId;
            }

            // Check Balance (Double check)
            if (Number(user.balance) < finalPrice) {
                delete session.data.pendingPurchase;
                await ctx.answerCallbackQuery({ text: '❌ موجودی کافی نیست', show_alert: true });
                return;
            }

            await ctx.answerCallbackQuery({ text: 'در حال پردازش...' });
            await ctx.editMessageText('⏳ در حال ایجاد سرویس...');

            const useCase = new PurchaseProductUseCase(userRepo, productRepo);
            const result = await useCase.execute({
                userId: user.id,
                productId,
                finalPrice: finalPrice
            });

            // Clear pending flag
            delete session.data.pendingPurchase;

            if (result.success && result.invoice) {
                // Increment discount usage if used
                if (discountId) {
                    const { DiscountHandler } = require('../admin/DiscountHandler');
                    await DiscountHandler.incrementUsage(discountId);
                    // Clear discount from session
                    delete session.data.discount;
                }

                const inv = result.invoice;
                let message = `✅ <b>سرویس با موفقیت ایجاد شد!</b>\n\n`;
                message += `👤 نام کاربری: <code>${inv.username}</code>\n`;
                message += `📦 محصول: ${inv.productName}\n`;
                message += `💰 مبلغ پرداختی: ${finalPrice.toLocaleString('fa-IR')} تومان\n`;
                message += `⏰ تاریخ انقضا: ${new Date(inv.expiresAt).toLocaleDateString('fa-IR')}\n\n`;

                const keyboard = new InlineKeyboard();

                if (inv.subscriptionUrl) {
                    message += `🔗 لینک اشتراک:\n<code>${inv.subscriptionUrl}</code>\n\n`;
                    keyboard.url('📱 کپی لینک اشتراک', inv.subscriptionUrl);
                }

                await ctx.editMessageText(message, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                });
            } else {
                await ctx.editMessageText(
                    `❌ خطا در ایجاد سرویس:\n${result.error}\n\nلطفاً با پشتیبانی تماس بگیرید.`
                );
            }
        } catch (error) {
            logger.error('Error in executePurchase:', error);

            // Clear pending flag on error
            const { UserConversationHandler } = require('./UserConversationHandler');
            const session = UserConversationHandler.getSession(ctx.from?.id || 0);
            delete session.data.pendingPurchase;

            await ctx.editMessageText('❌ خطایی در نهایی‌سازی خرید رخ داد.');
        }
    }

    async showMyServices(ctx: Context) {
        try {
            if (!ctx.from) return;

            const user = await userRepo.findByChatId(BigInt(ctx.from.id));
            if (!user) return;

            const invoices = await invoiceRepo.findActiveByUserId(user.id);

            if (invoices.length === 0) {
                await ctx.reply('📭 شما هیچ سرویس فعالی ندارید.');
                return;
            }

            let message = '📦 <b>سرویس‌های فعال شما:</b>\n\n';

            for (const inv of invoices) {
                message += `━━━━━━━━━━━━━━━\n`;
                message += `👤 نام کاربری: <code>${inv.username}</code>\n`;
                message += `📦 محصول: ${inv.productName}\n`;
                message += `⏰ انقضا: ${new Date(inv.expiresAt!).toLocaleDateString('fa-IR')}\n`;
                message += `🔗 لینک: <code>${inv.subscriptionUrl}</code>\n\n`;
            }

            await ctx.reply(message, { parse_mode: 'HTML' });
        } catch (error) {
            logger.error('Error in showMyServices:', error);
            await ctx.reply('❌ خطایی در نمایش سرویس‌ها رخ داد.');
        }
    }
}
