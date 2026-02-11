import { InlineKeyboard } from 'grammy';

/**
 * Main admin panel keyboard
 */
export function getAdminMainKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('📊 آمار', 'admin:stats')
        .text('👥 کاربران', 'admin:users').row()
        .text('🖥 پنل‌ها', 'admin:panels')
        .text('📦 محصولات', 'admin:products').row()
        .text('👤 ادمین‌ها', 'admin:admins')
        .text('📢 پیام انبوه', 'admin:broadcast').row()
        .text('✏️ متون', 'admin:texts')
        .text('💳 پرداخت', 'admin:payments').row()
        .text('📺 کانال', 'admin:channels')
        .text('🎟 تخفیف', 'admin:discounts').row()
        .text('🔙 بازگشت', 'main_menu');
}

/**
 * Statistics menu keyboard
 */
export function getStatsKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('👥 آمار کاربران', 'admin:stats:users').row()
        .text('💰 آمار فروش', 'admin:stats:sales').row()
        .text('🔐 آمار سرویس‌ها', 'admin:stats:services').row()
        .text('🖥 آمار پنل‌ها', 'admin:stats:panels').row()
        .text('🔙 بازگشت', 'admin:menu');
}

/**
 * User management keyboard
 */
export function getUserManagementKeyboard(userId: number): InlineKeyboard {
    return new InlineKeyboard()
        .text('👁 مشاهده پروفایل', `admin:user:view:${userId}`).row()
        .text('➕ افزایش موجودی', `admin:user:add_balance:${userId}`)
        .text('➖ کاهش موجودی', `admin:user:sub_balance:${userId}`).row()
        .text('🚫 مسدود کردن', `admin:user:ban:${userId}`)
        .text('✅ رفع مسدودی', `admin:user:unban:${userId}`).row()
        .text('🔐 سرویس‌ها', `admin:user:services:${userId}`).row()
        .text('💬 ارسال پیام', `admin:user:send_msg:${userId}`).row()
        .text('🔙 بازگشت', 'admin:users');
}

/**
 * Panel management keyboard
 */
export function getPanelManagementKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('➕ افزودن پنل', 'admin:panel:add').row()
        .text('📋 لیست پنل‌ها', 'admin:panel:list').row()
        .text('🔙 بازگشت', 'admin:menu');
}

/**
 * Panel action keyboard
 */
export function getPanelActionKeyboard(panelId: number): InlineKeyboard {
    return new InlineKeyboard()
        .text('✏️ ویرایش', `admin:panel:edit:${panelId}`)
        .text('🔌 تست اتصال', `admin:panel:test:${panelId}`).row()
        .text('🗑 حذف', `admin:panel:delete:${panelId}`)
        .text('🔄 فعال/غیرفعال', `admin:panel:toggle:${panelId}`).row()
        .text('🔙 بازگشت', 'admin:panels');
}

/**
 * Product management keyboard
 */
export function getProductManagementKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('➕ افزودن محصول', 'admin:product:add').row()
        .text('📋 لیست محصولات', 'admin:product:list').row()
        .text('🔙 بازگشت', 'admin:menu');
}

/**
 * Product action keyboard
 */
export function getProductActionKeyboard(productId: number): InlineKeyboard {
    return new InlineKeyboard()
        .text('✏️ ویرایش', `admin:product:edit:${productId}`)
        .text('🔄 فعال/غیرفعال', `admin:product:toggle:${productId}`).row()
        .text('🗑 حذف', `admin:product:delete:${productId}`).row()
        .text('🔙 بازگشت', 'admin:products');
}

/**
 * Broadcast target selection keyboard
 */
export function getBroadcastTargetKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('👥 همه کاربران', 'admin:broadcast:all').row()
        .text('✅ دارندگان سرویس فعال', 'admin:broadcast:active').row()
        .text('❌ کاربران غیرفعال', 'admin:broadcast:inactive').row()
        .text('🔙 بازگشت', 'admin:menu');
}

/**
 * Confirmation keyboard
 */
export function getConfirmationKeyboard(action: string, data?: string): InlineKeyboard {
    const callbackData = data ? `${action}:${data}` : action;
    return new InlineKeyboard()
        .text('✅ تایید', `confirm:${callbackData}`)
        .text('❌ انصراف', 'admin:menu');
}

/**
 * Pagination keyboard
 */
export function getPaginationKeyboard(
    page: number,
    totalPages: number,
    baseCallback: string
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (page > 1) {
        keyboard.text('⬅️ قبلی', `${baseCallback}:page:${page - 1}`);
    }

    keyboard.text(`📄 ${page}/${totalPages}`, 'noop');

    if (page < totalPages) {
        keyboard.text('➡️ بعدی', `${baseCallback}:page:${page + 1}`);
    }

    return keyboard.row().text('🔙 بازگشت', 'admin:menu');
}
