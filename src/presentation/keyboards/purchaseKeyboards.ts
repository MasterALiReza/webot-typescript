import { InlineKeyboard } from 'grammy';
import { Panel, Product } from '@prisma/client';

/**
 * Purchase Flow Keyboards
 * All keyboards related to the purchase process
 */

/**
 * Panel selection keyboard
 */
export function getPanelSelectionKeyboard(panels: Panel[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    for (const panel of panels) {
        const statusEmoji = panel.status === 'ACTIVE' ? '✅' : '❌';
        keyboard.text(
            `${statusEmoji} ${panel.name}`,
            `buy:panel:${panel.id}`
        ).row();
    }

    keyboard.text('🔙 منوی اصلی', 'main_menu');

    return keyboard;
}

/**
 * Product selection keyboard by panel
 */
export function getProductSelectionKeyboard(
    products: Array<Product & { panel: Panel }>
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    for (const product of products) {
        if (!product.isActive) continue;

        const price = Number(product.price).toLocaleString('fa-IR');
        keyboard.text(
            `📦 ${product.name} - ${price} تومان`,
            `buy:product:${product.id}`
        ).row();
    }

    keyboard.text('🔙 انتخاب پنل', 'buy');

    return keyboard;
}

/**
 * Product detail keyboard with purchase button
 */
export function getProductDetailKeyboard(productId: number): InlineKeyboard {
    return new InlineKeyboard()
        .text('✅ خرید این محصول', `buy:confirm:${productId}`).row()
        .text('🔙 بازگشت به لیست', 'buy:products');
}

/**
 * Payment method selection keyboard
 */
export function getPaymentMethodKeyboard(hasBalance: boolean = false): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Wallet payment if user has balance
    if (hasBalance) {
        keyboard.text('💰 پرداخت از کیف پول', 'payment:wallet').row();
    }

    // Card to card
    keyboard.text('💳 کارت به کارت', 'payment:card').row();

    // Zarinpal
    keyboard.text('🏦 درگاه زرین‌پال', 'payment:zarinpal').row();

    // Crypto
    keyboard.text('₿ ارز دیجیتال', 'payment:crypto').row();

    // Back
    keyboard.text('🔙 بازگشت', 'buy');

    return keyboard;
}

/**
 * Card payment confirmation keyboard
 */
export function getCardPaymentKeyboard(paymentId: number): InlineKeyboard {
    return new InlineKeyboard()
        .text('📷 ارسال رسید', `payment:receipt:${paymentId}`).row()
        .text('✅ پرداخت کردم', `payment:confirm:${paymentId}`).row()
        .text('❌ انصراف', 'buy');
}

/**
 * Purchase confirmation keyboard
 */
export function getPurchaseConfirmationKeyboard(
    productId: number,
    panelId: number
): InlineKeyboard {
    return new InlineKeyboard()
        .text('✅ تایید و ادامه', `purchase:confirm:${productId}:${panelId}`).row()
        .text('❌ انصراف', 'buy');
}

/**
 * Payment gateway redirect keyboard
 */
export function getPaymentGatewayKeyboard(paymentUrl: string): InlineKeyboard {
    return new InlineKeyboard()
        .url('💳 پرداخت آنلاین', paymentUrl).row()
        .text('🔙 بازگشت', 'buy');
}

/**
 * Payment success keyboard
 */
export function getPaymentSuccessKeyboard(invoiceId: number): InlineKeyboard {
    return new InlineKeyboard()
        .text('🔐 مشاهده سرویس', `service:view:${invoiceId}`).row()
        .text('🛒 خرید مجدد', 'buy')
        .text('🏠 منوی اصلی', 'main_menu');
}

/**
 * Payment failed keyboard
 */
export function getPaymentFailedKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('🔄 تلاش مجدد', 'buy').row()
        .text('💬 تماس با پشتیبانی', 'support').row()
        .text('🏠 منوی اصلی', 'main_menu');
}

/**
 * Username configuration keyboard
 */
export function getUsernameConfigKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('🎲 تصادفی', 'username:random').row()
        .text('✏️ انتخاب دستی', 'username:custom').row()
        .text('🔙 بازگشت', 'buy');
}

/**
 * Test account request keyboard
 */
export function getTestAccountKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('🧪 درخواست اکانت تست', 'buy:test').row()
        .text('🛒 خرید سرویس کامل', 'buy').row()
        .text('🔙 منوی اصلی', 'main_menu');
}
