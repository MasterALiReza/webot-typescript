import { InlineKeyboard, Keyboard } from 'grammy';
import { Invoice } from '@prisma/client';

/**
 * User Keyboards - All keyboards for regular user interactions
 */

/**
 * Main menu keyboard - Primary navigation
 */
export function getMainMenuKeyboard(): Keyboard {
    return new Keyboard()
        .text('🛒 خرید سرویس')
        .text('🔐 سرویس‌های من').row()
        .text('💰 کیف پول')
        .text('💬 پشتیبانی').row()
        .text('👤 پروفایل')
        .text('❓ راهنما')
        .resized();
}

/**
 * Main menu inline keyboard - For callback navigation
 */
export function getMainMenuInlineKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('🛒 خرید سرویس', 'buy')
        .text('🔐 سرویس‌های من', 'my_services').row()
        .text('💰 کیف پول', 'wallet')
        .text('💬 پشتیبانی', 'support').row()
        .text('👤 پروفایل', 'profile')
        .text('❓ راهنما', 'help');
}

/**
 * Back to main menu keyboard
 */
export function getBackToMainKeyboard(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 منوی اصلی', 'main_menu');
}

/**
 * My services list keyboard
 */
export function getMyServicesKeyboard(services: Invoice[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (services.length === 0) {
        keyboard.text('🛒 خرید اولین سرویس', 'buy');
        return keyboard;
    }

    for (const service of services.slice(0, 10)) {
        const statusEmoji = getServiceStatusEmoji(service.status);
        keyboard.text(
            `${statusEmoji} ${service.username}`,
            `service:view:${service.id}`
        ).row();
    }

    if (services.length > 10) {
        keyboard.text('📋 مشاهده همه', 'services:all').row();
    }

    keyboard.text('🔙 منوی اصلی', 'main_menu');

    return keyboard;
}

/**
 * Service detail keyboard - Actions for a specific service
 */
export function getServiceDetailKeyboard(serviceId: number, status: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Renew/Extend button for active or expired services
    if (status === 'ACTIVE' || status === 'REMOVED') {
        keyboard.text('🔄 تمدید سرویس', `service:renew:${serviceId}`).row();
    }

    // Connection details button
    keyboard.text('🔗 اطلاعات اتصال', `service:connection:${serviceId}`).row();

    // QR code button
    keyboard.text('📱 QR Code', `service:qr:${serviceId}`).row();

    // Test button for active services
    if (status === 'ACTIVE') {
        keyboard.text('🧪 تست اتصال', `service:test:${serviceId}`).row();
    }

    // Support button
    keyboard.text('💬 گزارش مشکل', `support:service:${serviceId}`).row();

    // Back button
    keyboard.text('🔙 بازگشت', 'my_services');

    return keyboard;
}

/**
 * Wallet menu keyboard
 */
export function getWalletMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('💳 شارژ کیف پول', 'wallet:charge').row()
        .text('📋 تراکنش‌ها', 'wallet:transactions').row()
        .text('👥 دعوت دوستان', 'wallet:referral').row()
        .text('🔙 منوی اصلی', 'main_menu');
}

/**
 * Wallet charge amount keyboard
 */
export function getWalletChargeAmountsKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('10,000 تومان', 'wallet:charge:10000')
        .text('20,000 تومان', 'wallet:charge:20000').row()
        .text('50,000 تومان', 'wallet:charge:50000')
        .text('100,000 تومان', 'wallet:charge:100000').row()
        .text('200,000 تومان', 'wallet:charge:200000')
        .text('500,000 تومان', 'wallet:charge:500000').row()
        .text('💰 مبلغ دلخواه', 'wallet:charge:custom').row()
        .text('🔙 بازگشت', 'wallet');
}

/**
 * Support menu keyboard
 */
export function getSupportMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('💬 ارسال تیکت', 'support:new').row()
        .text('📋 تیکت‌های من', 'support:my_tickets').row()
        .text('❓ سوالات متداول', 'support:faq').row()
        .text('📞 اطلاعات تماس', 'support:contact').row()
        .text('🔙 منوی اصلی', 'main_menu');
}

/**
 * Support ticket categories keyboard
 */
export function getSupportCategoriesKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('🔧 مشکل فنی', 'support:category:technical').row()
        .text('💳 مسائل مالی', 'support:category:financial').row()
        .text('🔐 مشکل سرویس', 'support:category:service').row()
        .text('❓ سوال عمومی', 'support:category:general').row()
        .text('💡 پیشنهاد', 'support:category:suggestion').row()
        .text('🔙 بازگشت', 'support');
}

/**
 * Profile menu keyboard
 */
export function getProfileMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('✏️ ویرایش نام', 'profile:edit_name').row()
        .text('📱 ویرایش شماره', 'profile:edit_phone').row()
        .text('👥 کد معرف من', 'profile:referral_code').row()
        .text('📊 آمار من', 'profile:stats').row()
        .text('🔙 منوی اصلی', 'main_menu');
}

/**
 * Helper: Get service status emoji
 */
function getServiceStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
        ACTIVE: '✅',
        PENDING: '⏳',
        DISABLED: '❌',
        REMOVED: '🗑',
        EXPIRED: '⏰',
    };
    return emojiMap[status] || '❓';
}
