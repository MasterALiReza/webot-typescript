import { Context } from 'grammy';
import { UserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { ProductRepository } from '../../../infrastructure/database/repositories/ProductRepository';
import { InvoiceRepository } from '../../../infrastructure/database/repositories/InvoiceRepository';
import { PanelRepository } from '../../../infrastructure/database/repositories/PanelRepository';
import { loadConfig } from '../../../shared/config';

const config = loadConfig();
const userRepo = new UserRepository();
const productRepo = new ProductRepository();
const invoiceRepo = new InvoiceRepository();
const panelRepo = new PanelRepository();

export class AdminHandler {
    private isAdmin(chatId: bigint): boolean {
        const adminIds = config.ADMIN_CHAT_ID.split(',').map(id => BigInt(id.trim()));
        return adminIds.includes(chatId);
    }

    async showAdminPanel(ctx: Context) {
        if (!ctx.from || !this.isAdmin(BigInt(ctx.from.id))) {
            await ctx.reply('⛔️ شما دسترسی به پنل ادمین ندارید.');
            return;
        }

        const [totalUsers, blockedUsers, totalProducts, totalPanels] = await Promise.all([
            userRepo.countAll(),
            userRepo.countBlocked(),
            productRepo.countAll(),
            panelRepo.countAll(),
        ]);

        const activeInvoices = await invoiceRepo.countByStatus('ACTIVE');
        const totalRevenue = await invoiceRepo.getTotalRevenue();
        const todayRevenue = await invoiceRepo.getRevenueToday();

        let message = `👑 <b>پنل مدیریت</b>\n\n`;
        message += `📊 <b>آمار کلی:</b>\n`;
        message += `👥 کل کاربران: ${totalUsers}\n`;
        message += `⛔️ کاربران مسدود: ${blockedUsers}\n`;
        message += `📦 سرویس‌های فعال: ${activeInvoices}\n`;
        message += `🛍 محصولات: ${totalProducts}\n`;
        message += `🖥 پنل‌ها: ${totalPanels}\n\n`;
        message += `💰 <b>درآمد:</b>\n`;
        message += `💵 کل درآمد: ${totalRevenue.toLocaleString('fa-IR')} تومان\n`;
        message += `📈 درآمد امروز: ${todayRevenue.toLocaleString('fa-IR')} تومان\n`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '👥 مدیریت کاربران', callback_data: 'admin:users' },
                    { text: '📦 مدیریت محصولات', callback_data: 'admin:products' },
                ],
                [
                    { text: '🖥 مدیریت پنل‌ها', callback_data: 'admin:panels' },
                    { text: '💰 مدیریت پرداخت‌ها', callback_data: 'admin:payments' },
                ],
                [
                    { text: '📊 گزارش‌ها', callback_data: 'admin:reports' },
                    { text: '⚙️ تنظیمات', callback_data: 'admin:settings' },
                ],
                [{ text: '🔙 بازگشت', callback_data: 'main_menu' }],
            ],
        };

        await ctx.reply(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });
    }

    async showUserManagement(ctx: Context) {
        if (!ctx.from || !this.isAdmin(BigInt(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: 'دسترسی غیرمجاز' });
            return;
        }

        let message = `👥 <b>مدیریت کاربران</b>\n\n`;
        message += `از دکمه‌های زیر برای مدیریت کاربران استفاده کنید:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔍 جستجوی کاربر', callback_data: 'admin:search_user' }],
                [{ text: '⛔️ مسدود کردن کاربر', callback_data: 'admin:block_user' }],
                [{ text: '✅ رفع مسدودی', callback_data: 'admin:unblock_user' }],
                [{ text: '💰 شارژ کیف پول', callback_data: 'admin:charge_user' }],
                [{ text: '📊 لیست کاربران', callback_data: 'admin:list_users' }],
                [{ text: '🔙 بازگشت', callback_data: 'admin:panel' }],
            ],
        };

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });

        await ctx.answerCallbackQuery();
    }

    async showProductManagement(ctx: Context) {
        if (!ctx.from || !this.isAdmin(BigInt(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: 'دسترسی غیرمجاز' });
            return;
        }

        const products = await productRepo.findAllActive();

        let message = `📦 <b>مدیریت محصولات</b>\n\n`;

        if (products.length > 0) {
            message += `<b>محصولات فعال:</b>\n\n`;
            for (const product of products) {
                message += `📦 ${product.name}\n`;
                message += `├ قیمت: ${product.price} تومان\n`;
                message += `├ حجم: ${product.volume} GB\n`;
                message += `└ مدت: ${product.duration} روز\n\n`;
            }
        } else {
            message += `❌ محصولی یافت نشد.\n\n`;
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '➕ افزودن محصول', callback_data: 'admin:add_product' }],
                [{ text: '✏️ ویرایش محصول', callback_data: 'admin:edit_product' }],
                [{ text: '🗑 حذف محصول', callback_data: 'admin:delete_product' }],
                [{ text: '🔙 بازگشت', callback_data: 'admin:panel' }],
            ],
        };

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });

        await ctx.answerCallbackQuery();
    }

    async showPanelManagement(ctx: Context) {
        if (!ctx.from || !this.isAdmin(BigInt(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: 'دسترسی غیرمجاز' });
            return;
        }

        const panels = await panelRepo.findAll();

        let message = `🖥 <b>مدیریت پنل‌ها</b>\n\n`;

        if (panels.length > 0) {
            message += `<b>پنل‌های موجود:</b>\n\n`;
            for (const panel of panels) {
                const statusEmoji = panel.status === 'ACTIVE' ? '✅' : '❌';
                message += `${statusEmoji} ${panel.name}\n`;
                message += `├ نوع: ${panel.type}\n`;
                message += `├ URL: ${panel.url}\n`;
                message += `└ وضعیت: ${panel.status}\n\n`;
            }
        } else {
            message += `❌ پنلی یافت نشد.\n\n`;
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '➕ افزودن پنل', callback_data: 'admin:add_panel' }],
                [{ text: '✏️ ویرایش پنل', callback_data: 'admin:edit_panel' }],
                [{ text: '🗑 حذف پنل', callback_data: 'admin:delete_panel' }],
                [{ text: '🔄 تست اتصال', callback_data: 'admin:test_panel' }],
                [{ text: '🔙 بازگشت', callback_data: 'admin:panel' }],
            ],
        };

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });

        await ctx.answerCallbackQuery();
    }
}
