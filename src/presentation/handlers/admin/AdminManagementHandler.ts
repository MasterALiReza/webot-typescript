import { Context } from 'grammy';
import { config } from '../../../shared/config';
import { logger } from '../../../shared/logger';

/**
 * AdminManagementHandler - Manage admin users
 * Note: Currently uses environment variable ADMIN_CHAT_ID
 * Future enhancement: Database-based with roles
 */
export class AdminManagementHandler {
    /**
     * Handle admin:admins - Show admin management menu
     */
    static async handleAdminsMenu(ctx: Context): Promise<void> {
        try {
            const adminIds = config.ADMIN_CHAT_ID.split(',').map(id => id.trim());

            let message = `
👤 <b>مدیریت ادمین‌ها</b>

📊 <b>تعداد ادمین‌ها:</b> ${adminIds.length}

<b>لیست ادمین‌ها:</b>
`;

            for (const adminId of adminIds) {
                message += `\n• <code>${adminId}</code>`;
            }

            message += `

⚙️ <b>توضیحات:</b>
فعلاً مدیریت ادمین‌ها از طریق متغیر محیطی <code>ADMIN_CHAT_ID</code> انجام می‌شود.

برای افزودن یا حذف ادمین، این متغیر را در فایل <code>.env</code> ویرایش کنید:

<code>ADMIN_CHAT_ID=123456,789012,345678</code>

🔮 <b>ویژگی آینده:</b>
مدیریت ادمین‌ها با پایگاه داده و سطوح دسترسی مختلف.
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
            logger.error('Error showing admins menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Check if user is admin
     */
    static isAdmin(userId: number): boolean {
        try {
            const adminIds = config.ADMIN_CHAT_ID
                .split(',')
                .map(id => BigInt(id.trim()));

            return adminIds.includes(BigInt(userId));
        } catch (error) {
            logger.error('Error checking admin status:', error);
            return false;
        }
    }

    /**
     * Get all admin IDs
     */
    static getAdminIds(): bigint[] {
        try {
            return config.ADMIN_CHAT_ID
                .split(',')
                .map(id => BigInt(id.trim()));
        } catch (error) {
            logger.error('Error getting admin IDs:', error);
            return [];
        }
    }
}
