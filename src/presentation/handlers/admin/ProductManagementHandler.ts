import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { getProductManagementKeyboard, getProductActionKeyboard } from '../../keyboards/adminKeyboards';
import { logger } from '../../../shared/logger';

/**
 * ProductManagementHandler - Manage VPN products/plans
 */
export class ProductManagementHandler {
    /**
     * Handle admin:products - Show product management menu
     */
    static async handleProductsMenu(ctx: Context): Promise<void> {
        try {
            const message = `
📦 <b>مدیریت محصولات</b>

از منوی زیر گزینه مورد نظر را انتخاب کنید:
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getProductManagementKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing products menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:product:list - List all products
     */
    static async handleProductList(ctx: Context): Promise<void> {
        try {
            const products = await prisma.product.findMany({
                include: {
                    panel: true,
                    _count: {
                        select: { invoices: true },
                    },
                },
                orderBy: { price: 'asc' },
            });

            if (products.length === 0) {
                await ctx.editMessageText('❌ هیچ محصولی ثبت نشده است.', {
                    reply_markup: getProductManagementKeyboard(),
                });
                await ctx.answerCallbackQuery();
                return;
            }

            let message = '📦 <b>لیست محصولات:</b>\n\n';

            for (const product of products) {
                const statusEmoji = product.isActive ? '✅' : '❌';
                message += `${statusEmoji} <b>${product.name}</b>\n`;
                message += `   قیمت: ${Number(product.price).toLocaleString('fa-IR')} تومان\n`;
                message += `   حجم: ${product.volume} GB\n`;
                message += `   مدت: ${product.duration} روز\n`;
                message += `   پنل: ${product.panel.name}\n`;
                message += `   فروش: ${product._count.invoices}\n`;
                message += `   /viewproduct_${product.id}\n\n`;
            }

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getProductManagementKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error listing products:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle /viewproduct_{id} command - View product details
     */
    static async handleViewProduct(ctx: Context, productId: number): Promise<void> {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    panel: true,
                    _count: {
                        select: { invoices: true },
                    },
                },
            });

            if (!product) {
                const msg = ctx.callbackQuery ? '❌ محصول یافت نشد' : '❌ محصول یافت نشد.';
                if (ctx.callbackQuery) {
                    await ctx.answerCallbackQuery({ text: msg });
                } else {
                    await ctx.reply(msg);
                }
                return;
            }

            const statusEmoji = product.isActive ? '✅' : '❌';
            const statusText = product.isActive ? 'فعال' : 'غیرفعال';

            const message = `
📦 <b>اطلاعات محصول</b>

📌 <b>نام:</b> ${product.name}
${product.description ? `📝 <b>توضیحات:</b> ${product.description}\n` : ''}
💰 <b>قیمت:</b> ${Number(product.price).toLocaleString('fa-IR')} تومان
📊 <b>حجم:</b> ${product.volume} GB
⏱ <b>مدت:</b> ${product.duration} روز

🖥 <b>پنل:</b> ${product.panel.name}
${statusEmoji} <b>وضعیت:</b> ${statusText}

📈 <b>آمار فروش:</b> ${product._count.invoices} سرویس
            `.trim();

            if (ctx.callbackQuery) {
                await ctx.editMessageText(message, {
                    parse_mode: 'HTML',
                    reply_markup: getProductActionKeyboard(productId),
                });
            } else {
                await ctx.reply(message, {
                    parse_mode: 'HTML',
                    reply_markup: getProductActionKeyboard(productId),
                });
            }
        } catch (error) {
            logger.error('Error viewing product:', error);
            if (ctx.callbackQuery) {
                await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
            } else {
                await ctx.reply('❌ خطا رخ داد.');
            }
        }
    }

    /**
     * Handle admin:product:toggle:{id} - Toggle product status
     */
    static async handleToggleProduct(ctx: Context, productId: number): Promise<void> {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!product) {
                await ctx.answerCallbackQuery({ text: '❌ محصول یافت نشد' });
                return;
            }

            await prisma.product.update({
                where: { id: productId },
                data: { isActive: !product.isActive },
            });

            await ctx.answerCallbackQuery({
                text: product.isActive ? '❌ محصول غیرفعال شد' : '✅ محصول فعال شد'
            });

            // Refresh product view
            await this.handleViewProduct(ctx, productId);

            logger.info(`Product ${productId} toggled by admin ${ctx.from?.id}`);
        } catch (error) {
            logger.error('Error toggling product:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:product:delete:{id} - Delete product with confirmation
     */
    static async handleDeleteProduct(ctx: Context, productId: number): Promise<void> {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    _count: {
                        select: { invoices: true },
                    },
                },
            });

            if (!product) {
                await ctx.answerCallbackQuery({ text: '❌ محصول یافت نشد' });
                return;
            }

            if (product._count.invoices > 0) {
                await ctx.editMessageText(
                    `⚠️ <b>هشدار</b>\n\n` +
                    `این محصول دارای ${product._count.invoices} سرویس فعال/تاریخی است.\n\n` +
                    `حذف محصول ممکن است بر سرویس‌های موجود تأثیر بگذارد.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '✅ بله، حذف شود', callback_data: `confirm:product:delete:${productId}` },
                                { text: '❌ انصراف', callback_data: 'admin:products' },
                            ]],
                        },
                    }
                );
                await ctx.answerCallbackQuery();
                return;
            }

            // Show confirmation
            await ctx.editMessageText(
                `⚠️ <b>تایید حذف محصول</b>\n\n` +
                `نام: ${product.name}\n` +
                `قیمت: ${Number(product.price).toLocaleString('fa-IR')} تومان\n\n` +
                `آیا مطمئن هستید؟`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ بله، حذف شود', callback_data: `confirm:product:delete:${productId}` },
                            { text: '❌ انصراف', callback_data: 'admin:products' },
                        ]],
                    },
                }
            );

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in delete product handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Confirm product deletion
     */
    static async confirmDeleteProduct(ctx: Context, productId: number): Promise<void> {
        try {
            await prisma.product.delete({
                where: { id: productId },
            });

            await ctx.editMessageText(
                '✅ محصول با موفقیت حذف شد.',
                {
                    reply_markup: getProductManagementKeyboard(),
                }
            );

            await ctx.answerCallbackQuery({ text: '✅ محصول حذف شد' });

            logger.info(`Product ${productId} deleted by admin ${ctx.from?.id}`);
        } catch (error) {
            logger.error('Error deleting product:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا در حذف محصول' });
        }
    }

    /**
     * Handle admin:product:add - Add new product (placeholder)
     */
    static async handleAddProduct(ctx: Context): Promise<void> {
        try {
            await ctx.editMessageText(
                '➕ <b>افزودن محصول جدید</b>\n\n' +
                'این ویژگی به زودی اضافه می‌شود.\n\n' +
                'فعلاً می‌توانید از پایگاه داده مستقیماً محصول اضافه کنید.',
                {
                    parse_mode: 'HTML',
                    reply_markup: getProductManagementKeyboard(),
                }
            );

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in add product handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:product:edit:{id} - Edit product (placeholder)
     */
    static async handleEditProduct(ctx: Context, productId: number): Promise<void> {
        try {
            await ctx.editMessageText(
                '✏️ <b>ویرایش محصول</b>\n\n' +
                'این ویژگی به زودی اضافه می‌شود.\n\n' +
                'فعلاً می‌توانید از پایگاه داده مستقیماً محصول را ویرایش کنید.',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 بازگشت', callback_data: `admin:product:view:${productId}` },
                        ]],
                    },
                }
            );

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in edit product handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }
}
