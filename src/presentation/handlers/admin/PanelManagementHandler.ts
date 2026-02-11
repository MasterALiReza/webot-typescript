import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { PanelFactory } from '../../../infrastructure/panels/PanelFactory';
import { getPanelManagementKeyboard, getPanelActionKeyboard } from '../../keyboards/adminKeyboards';
import { logger } from '../../../shared/logger';
import { PanelType } from '@prisma/client';

/**
 * PanelManagementHandler - CRUD operations for panels
 */
export class PanelManagementHandler {
    /**
     * Handle admin:panels - Show panel management menu
     */
    static async handlePanelsMenu(ctx: Context): Promise<void> {
        try {
            const message = `
🖥 <b>مدیریت پنل‌ها</b>

از منوی زیر گزینه مورد نظر را انتخاب کنید:
            `.trim();

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getPanelManagementKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error showing panels menu:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:panel:list - List all panels
     */
    static async handlePanelList(ctx: Context): Promise<void> {
        try {
            const panels = await prisma.panel.findMany({
                include: {
                    _count: {
                        select: { invoices: true },
                    },
                },
                orderBy: { name: 'asc' },
            });

            if (panels.length === 0) {
                await ctx.editMessageText('❌ هیچ پنلی ثبت نشده است.', {
                    reply_markup: getPanelManagementKeyboard(),
                });
                await ctx.answerCallbackQuery();
                return;
            }

            let message = '🖥 <b>لیست پنل‌ها:</b>\n\n';

            for (const panel of panels) {
                const statusEmoji = panel.status === 'ACTIVE' ? '✅' : '❌';
                message += `${statusEmoji} <b>${panel.name}</b>\n`;
                message += `   نوع: ${this.getPanelTypeLabel(panel.type)}\n`;
                message += `   URL: <code>${panel.url}</code>\n`;
                message += `   سرویس‌ها: ${panel._count.invoices}\n`;
                message += `   /viewpanel_${panel.id}\n\n`;
            }

            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: getPanelManagementKeyboard(),
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error listing panels:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle /viewpanel_{id} command - View panel details
     */
    static async handleViewPanel(ctx: Context, panelId: number): Promise<void> {
        try {
            const panel = await prisma.panel.findUnique({
                where: { id: panelId },
                include: {
                    _count: {
                        select: {
                            invoices: true,
                            products: true,
                        },
                    },
                },
            });

            if (!panel) {
                await ctx.reply('❌ پنل یافت نشد.');
                return;
            }

            const statusEmoji = panel.status === 'ACTIVE' ? '✅' : '❌';
            const statusText = panel.status === 'ACTIVE' ? 'فعال' : 'غیرفعال';

            const message = `
🖥 <b>اطلاعات پنل</b>

📌 <b>نام:</b> ${panel.name}
🔧 <b>نوع:</b> ${this.getPanelTypeLabel(panel.type)}
🌐 <b>URL:</b> <code>${panel.url}</code>
👤 <b>نام کاربری:</b> <code>${panel.username}</code>
${statusEmoji} <b>وضعیت:</b> ${statusText}

📊 <b>آمار:</b>
• محصولات: ${panel._count.products}
• سرویس‌ها: ${panel._count.invoices}

⚙️ <b>تنظیمات:</b>
• On-Hold: ${panel.onHoldEnabled ? 'فعال' : 'غیرفعال'}
• روش نام کاربری: ${panel.methodUsername}
            `.trim();

            if (ctx.callbackQuery) {
                await ctx.editMessageText(message, {
                    parse_mode: 'HTML',
                    reply_markup: getPanelActionKeyboard(panelId),
                });
            } else {
                await ctx.reply(message, {
                    parse_mode: 'HTML',
                    reply_markup: getPanelActionKeyboard(panelId),
                });
            }
        } catch (error) {
            logger.error('Error viewing panel:', error);
            if (ctx.callbackQuery) {
                await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
            } else {
                await ctx.reply('❌ خطا رخ داد.');
            }
        }
    }

    /**
     * Handle admin:panel:test:{id} - Test panel connection
     */
    static async handleTestPanel(ctx: Context, panelId: number): Promise<void> {
        try {
            await ctx.answerCallbackQuery({ text: '🔄 در حال تست اتصال...' });

            const panel = await prisma.panel.findUnique({
                where: { id: panelId },
            });

            if (!panel) {
                await ctx.reply('❌ پنل یافت نشد.');
                return;
            }

            // Test panel connection
            const adapter = PanelFactory.create(panel);

            let stats;
            try {
                stats = adapter.getSystemStats ? await adapter.getSystemStats() : null;
            } catch (err) {
                stats = null;
            }

            if (stats) {
                await ctx.reply(
                    `✅ <b>اتصال موفقیت‌آمیز</b>\n\n` +
                    `پنل: ${panel.name}\n` +
                    `نوع: ${this.getPanelTypeLabel(panel.type)}\n` +
                    `URL: <code>${panel.url}</code>\n\n` +
                    `✅ پنل در دسترس است.`,
                    { parse_mode: 'HTML' }
                );

                logger.info(`Panel ${panel.id} test successful`);
            } else {
                await ctx.reply(
                    `❌ <b>خطا در اتصال</b>\n\n` +
                    `پنل: ${panel.name}\n` +
                    `لطفاً تنظیمات را بررسی کنید.`,
                    { parse_mode: 'HTML' }
                );
            }
        } catch (error) {
            logger.error('Error testing panel:', error);
            await ctx.reply('❌ خطا در تست اتصال به پنل.');
        }
    }

    /**
     * Handle admin:panel:toggle:{id} - Toggle panel status
     */
    static async handleTogglePanel(ctx: Context, panelId: number): Promise<void> {
        try {
            const panel = await prisma.panel.findUnique({
                where: { id: panelId },
            });

            if (!panel) {
                await ctx.answerCallbackQuery({ text: '❌ پنل یافت نشد' });
                return;
            }

            const newStatus = panel.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

            await prisma.panel.update({
                where: { id: panelId },
                data: { status: newStatus },
            });

            await ctx.answerCallbackQuery({
                text: newStatus === 'ACTIVE' ? '✅ پنل فعال شد' : '❌ پنل غیرفعال شد'
            });

            // Refresh panel view
            await this.handleViewPanel(ctx, panelId);

            logger.info(`Panel ${panelId} toggled to ${newStatus} by admin ${ctx.from?.id}`);
        } catch (error) {
            logger.error('Error toggling panel:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:panel:delete:{id} - Delete panel with confirmation
     */
    static async handleDeletePanel(ctx: Context, panelId: number): Promise<void> {
        try {
            const panel = await prisma.panel.findUnique({
                where: { id: panelId },
                include: {
                    _count: {
                        select: { invoices: true, products: true },
                    },
                },
            });

            if (!panel) {
                await ctx.answerCallbackQuery({ text: '❌ پنل یافت نشد' });
                return;
            }

            if (panel._count.invoices > 0 || panel._count.products > 0) {
                await ctx.editMessageText(
                    `⚠️ <b>هشدار</b>\n\n` +
                    `این پنل دارای:\n` +
                    `• ${panel._count.products} محصول\n` +
                    `• ${panel._count.invoices} سرویس\n\n` +
                    `لطفاً ابتدا محصولات و سرویس‌ها را حذف کنید.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🔙 بازگشت', callback_data: `admin:panel:view:${panelId}` },
                            ]],
                        },
                    }
                );
                await ctx.answerCallbackQuery();
                return;
            }

            // Show confirmation
            await ctx.editMessageText(
                `⚠️ <b>تایید حذف پنل</b>\n\n` +
                `نام: ${panel.name}\n` +
                `نوع: ${this.getPanelTypeLabel(panel.type)}\n\n` +
                `آیا مطمئن هستید؟`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ بله، حذف شود', callback_data: `confirm:panel:delete:${panelId}` },
                            { text: '❌ انصراف', callback_data: 'admin:panels' },
                        ]],
                    },
                }
            );

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in delete panel handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Confirm panel deletion
     */
    static async confirmDeletePanel(ctx: Context, panelId: number): Promise<void> {
        try {
            await prisma.panel.delete({
                where: { id: panelId },
            });

            await ctx.editMessageText(
                '✅ پنل با موفقیت حذف شد.',
                {
                    reply_markup: getPanelManagementKeyboard(),
                }
            );

            await ctx.answerCallbackQuery({ text: '✅ پنل حذف شد' });

            logger.info(`Panel ${panelId} deleted by admin ${ctx.from?.id}`);
        } catch (error) {
            logger.error('Error deleting panel:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا در حذف پنل' });
        }
    }

    /**
     * Handle admin:panel:add - Add new panel
     */
    /**
     * Handle admin:panel:add - Add new panel
     */
    static async handleAddPanel(ctx: Context): Promise<void> {
        try {
            const userId = ctx.from?.id;
            if (userId) {
                const { AdminConversationHandler, AdminState } = require('./AdminConversationHandler');
                AdminConversationHandler.setState(userId, AdminState.WAITING_PANEL_NAME);
            }

            await ctx.editMessageText(
                '➕ <b>افزودن پنل جدید</b>\n\n' +
                'لطفاً <b>نام پنل</b> را وارد کنید:',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 بازگشت', callback_data: 'admin:panels' },
                        ]],
                    },
                }
            );

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in add panel handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle admin:panel:edit:{id} - Show edit menu
     */
    static async handleEditPanel(ctx: Context, panelId: number): Promise<void> {
        try {
            const panel = await prisma.panel.findUnique({ where: { id: panelId } });
            if (!panel) {
                await ctx.answerCallbackQuery({ text: '❌ پنل یافت نشد' });
                return;
            }

            await ctx.editMessageText(
                `✏️ <b>ویرایش پنل: ${panel.name}</b>\n\n` +
                `لطفاً فیلدی که می‌خواهید ویرایش کنید را انتخاب نمایید:`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: `✏️ نام`, callback_data: `admin:panel:edit:name:${panelId}` },
                                { text: `🌐 URL`, callback_data: `admin:panel:edit:url:${panelId}` },
                            ],
                            [
                                { text: `👤 نام کاربری`, callback_data: `admin:panel:edit:username:${panelId}` },
                                { text: `🔑 رمز عبور`, callback_data: `admin:panel:edit:password:${panelId}` },
                            ],
                            [
                                { text: '🔙 بازگشت', callback_data: `admin:panel:view:${panelId}` },
                            ]
                        ],
                    },
                }
            );

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in edit panel handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    /**
     * Handle specific field edit selection
     */
    static async handleEditPanelField(ctx: Context, panelId: number, field: string): Promise<void> {
        try {
            const userId = ctx.from?.id;
            if (!userId) return;

            const panel = await prisma.panel.findUnique({ where: { id: panelId } });
            if (!panel) {
                await ctx.answerCallbackQuery({ text: '❌ پنل یافت نشد' });
                return;
            }

            const { AdminConversationHandler, AdminState } = require('./AdminConversationHandler');

            let prompt = '';
            let state = '';

            switch (field) {
                case 'name':
                    state = AdminState.WAITING_PANEL_EDIT_NAME;
                    prompt = `✏️ <b>ویرایش نام پنل</b>\n\nنام فعلی: ${panel.name}\n\nلطفاً <b>نام جدید</b> را وارد کنید:`;
                    break;
                case 'url':
                    state = AdminState.WAITING_PANEL_EDIT_URL;
                    prompt = `🌐 <b>ویرایش آدرس پنل</b>\n\nآدرس فعلی: <code>${panel.url}</code>\n\nلطفاً <b>آدرس جدید</b> را وارد کنید:`;
                    break;
                case 'username':
                    state = AdminState.WAITING_PANEL_EDIT_USERNAME;
                    prompt = `👤 <b>ویرایش نام کاربری پنل</b>\n\nنام کاربری فعلی: <code>${panel.username}</code>\n\nلطفاً <b>نام کاربری جدید</b> را وارد کنید:`;
                    break;
                case 'password':
                    state = AdminState.WAITING_PANEL_EDIT_PASSWORD;
                    prompt = `🔑 <b>ویرایش رمز عبور پنل</b>\n\nلطفاً <b>رمز عبور جدید</b> را وارد کنید:`;
                    break;
                default:
                    return;
            }

            AdminConversationHandler.setState(userId, state, { panelId });

            await ctx.editMessageText(prompt, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 بازگشت', callback_data: `admin:panel:edit:${panelId}` },
                    ]],
                },
            });

            await ctx.answerCallbackQuery();
        } catch (error) {
            logger.error('Error in edit panel field handler:', error);
            await ctx.answerCallbackQuery({ text: '❌ خطا رخ داد' });
        }
    }

    // Helper method
    private static getPanelTypeLabel(type: PanelType): string {
        const labels: Record<PanelType, string> = {
            MARZBAN: 'Marzban',
            MARZNESHIN: 'Marzneshin',
            X_UI: 'X-UI',
            S_UI: 'S-UI',
            WGDASHBOARD: 'WireGuard Dashboard',
            MIKROTIK: 'MikroTik',
        };
        return labels[type] || type;
    }
}
