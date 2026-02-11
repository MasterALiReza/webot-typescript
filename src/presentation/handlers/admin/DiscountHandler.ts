import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/logger';

/**
 * DiscountHandler - Manage discount codes
 */
export class DiscountHandler {
    /**
     * Handle admin:discounts - Show discount management menu
     */
    static async handleDiscountsMenu(ctx: Context): Promise<void> {
        try {
            const codes = await prisma.discountCode.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10 // Show last 10
            });

            let message = '🎟 <b>مدیریت کدهای تخفیف</b>\n\n' +
                'لیست آخرین کدهای تخفیف:\n\n';

            if (codes.length === 0) {
                message += '❌ هیچ کد تخفیفی یافت نشد.\n';
            } else {
                codes.forEach((code) => {
                    const status = code.isActive ? '✅' : '❌';
                    message += `${status} <b>${code.code}</b>\n` +
                        `   تخفیف: ${code.percent}%\n` +
                        `   استفاده: ${code.usedCount}/${code.maxUses}\n` +
                        `   /delcode_${code.id}\n\n`;
                });
            }

            message += '\nبرای افزودن کد جدید، از دکمه زیر استفاده کنید.';

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ افزودن کد تخفیف جدید', callback_data: 'admin:discount:add' }],
                        [{ text: '🔙 بازگشت', callback_data: 'admin:menu' }],
                    ],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing discounts menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Validate and apply discount code
     */
    static async applyDiscount(
        code: string,
        _userId: number
    ): Promise<{ valid: boolean; discountPercent: number; message: string; codeId?: number }> {
        try {
            const discount = await prisma.discountCode.findUnique({
                where: { code: code }
            });

            if (!discount) {
                return { valid: false, discountPercent: 0, message: '❌ کد تخفیف نامعتبر است' };
            }

            if (!discount.isActive) {
                return { valid: false, discountPercent: 0, message: '❌ این کد تخفیف غیرفعال شده است' };
            }

            if (discount.maxUses > 0 && discount.usedCount >= discount.maxUses) {
                return { valid: false, discountPercent: 0, message: '❌ ظرفیت استفاده از این کد تکمیل شده است' };
            }

            if (discount.expiresAt && discount.expiresAt < new Date()) {
                return { valid: false, discountPercent: 0, message: '❌ مهلت استفاده از این کد به پایان رسیده است' };
            }

            // Check if user has already used this code?
            // Schema doesn't strictly track user-code usage relation in a separate table yet, 
            // but for simple implementation we assume global usage limit.
            // Complex implementation would need a DiscountUsage table.

            return {
                valid: true,
                discountPercent: discount.percent,
                message: `✅ کد تخفیف ${discount.percent}% اعمال شد!`,
                codeId: discount.id
            };

        } catch (error) {
            logger.error('Error applying discount:', error);
            return {
                valid: false,
                discountPercent: 0,
                message: '❌ خطا در بررسی کد تخفیف'
            };
        }
    }

    /**
     * Increment usage count for a discount code
     */
    static async incrementUsage(codeId: number) {
        await prisma.discountCode.update({
            where: { id: codeId },
            data: { usedCount: { increment: 1 } }
        });
    }

    /**
     * Handle admin:discount:add - Start add flow
     */
    static async handleAddDiscount(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        const { AdminConversationHandler, AdminState } = require('./AdminConversationHandler');
        AdminConversationHandler.setState(userId, AdminState.WAITING_DISCOUNT_CODE);

        await ctx.editMessageText(
            '🎟 <b>افزودن کد تخفیف جدید</b>\n\n' +
            'ابتدا، <b>عبارت کد تخفیف</b> را وارد کنید:\n' +
            '(مثلاً: SUMMER2024)',
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin:discounts' }]]
                }
            }
        );
        await ctx.answerCallbackQuery();
    }

    /**
     * Handle deleting a discount code
     */
    static async handleDeleteDiscount(ctx: Context, codeId: number): Promise<void> {
        try {
            await prisma.discountCode.delete({ where: { id: codeId } });
            await ctx.reply('✅ کد تخفیف با موفقیت حذف شد.');
        } catch (error) {
            logger.error('Error deleting discount code:', error);
            await ctx.reply('❌ خطا در حذف کد تخفیف.');
        }
    }
}
