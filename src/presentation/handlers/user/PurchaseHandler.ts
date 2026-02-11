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

    async confirmPurchase(ctx: Context, productId: number) {
        try {
            if (!ctx.from || !ctx.callbackQuery) return;

            const user = await userRepo.findByChatId(BigInt(ctx.from.id));
            if (!user) {
                await ctx.answerCallbackQuery({ text: 'خطا: کاربر یافت نشد' });
                return;
            }

            const product = await productRepo.findById(productId);
            if (!product) {
                await ctx.answerCallbackQuery({ text: 'محصول یافت نشد' });
                return;
            }

            const price = Number(product.price);
            const balance = Number(user.balance);

            let message = `📦 <b>${product.name}</b>\n\n`;
            message += `💰 قیمت: ${price} تومان\n`;
            message += `📊 حجم: ${product.volume} GB\n`;
            message += `⏰ مدت: ${product.duration} روز\n\n`;
            message += `💵 موجودی شما: ${balance} تومان\n`;

            const keyboard = new InlineKeyboard();

            if (balance >= price) {
                message += `\n✅ موجودی شما کافی است.\n\nآیا مطمئن هستید؟`;
                keyboard
                    .text('✅ تأیید خرید', `confirm:${productId}`)
                    .text('❌ انصراف', 'cancel')
                    .row();
            } else {
                const needed = price - balance;
                message += `\n⚠️ موجودی شما کافی نیست.\nمبلغ مورد نیاز: ${needed} تومان`;
                keyboard.text('💰 شارژ کیف پول', 'charge_wallet');
            }

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in confirmPurchase:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا در تأیید خرید' });
        }
    }

    async executePurchase(ctx: Context, productId: number) {
        try {
            if (!ctx.from || !ctx.callbackQuery) return;

            const user = await userRepo.findByChatId(BigInt(ctx.from.id));
            if (!user) {
                await ctx.answerCallbackQuery({ text: 'خطا: کاربر یافت نشد' });
                return;
            }

            await ctx.answerCallbackQuery({ text: 'در حال پردازش...' });
            await ctx.editMessageText('⏳ در حال ایجاد سرویس...');

            const useCase = new PurchaseProductUseCase(userRepo, productRepo, invoiceRepo);
            const result = await useCase.execute({
                userId: user.id,
                productId,
            });

            if (result.success && result.invoice) {
                const inv = result.invoice;
                let message = `✅ <b>سرویس با موفقیت ایجاد شد!</b>\n\n`;
                message += `👤 نام کاربری: <code>${inv.username}</code>\n`;
                message += `📦 محصول: ${inv.productName}\n`;
                message += `💰 مبلغ پرداختی: ${inv.productPrice} تومان\n`;
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
