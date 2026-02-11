import { InlineKeyboard, Keyboard } from 'grammy';

/**
 * Keyboard Builder Utilities
 * Reusable helpers for creating consistent keyboards
 */

/**
 * Create inline keyboard from button data
 */
export function createInlineKeyboard(
    buttons: Array<Array<{ text: string; data: string }>>
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    for (let i = 0; i < buttons.length; i++) {
        const row = buttons[i];
        for (const button of row) {
            keyboard.text(button.text, button.data);
        }
        if (i < buttons.length - 1) {
            keyboard.row();
        }
    }

    return keyboard;
}

/**
 * Create reply keyboard from button texts
 */
export function createReplyKeyboard(
    buttons: string[][],
    options?: {
        oneTime?: boolean;
        resize?: boolean;
        placeholder?: string;
    }
): Keyboard {
    const keyboard = new Keyboard();

    for (let i = 0; i < buttons.length; i++) {
        const row = buttons[i];
        for (const button of row) {
            keyboard.text(button);
        }
        if (i < buttons.length - 1) {
            keyboard.row();
        }
    }

    if (options?.oneTime) {
        keyboard.oneTime();
    }
    if (options?.resize !== false) {
        keyboard.resized();
    }
    if (options?.placeholder) {
        keyboard.placeholder(options.placeholder);
    }

    return keyboard;
}

/**
 * Build paginated keyboard with navigation
 */
export function buildPaginatedKeyboard(
    items: Array<{ id: number | string; label: string }>,
    callbackPrefix: string,
    page: number = 1,
    itemsPerPage: number = 10,
    backCallback?: string
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, items.length);
    const totalPages = Math.ceil(items.length / itemsPerPage);

    // Add items
    for (let i = startIdx; i < endIdx; i++) {
        keyboard.text(items[i].label, `${callbackPrefix}:${items[i].id}`).row();
    }

    // Add pagination controls if needed
    if (totalPages > 1) {
        const navRow: Array<{ text: string; data: string }> = [];

        if (page > 1) {
            navRow.push({ text: '⬅️ قبلی', data: `${callbackPrefix}:page:${page - 1}` });
        }

        navRow.push({ text: `📄 ${page}/${totalPages}`, data: 'noop' });

        if (page < totalPages) {
            navRow.push({ text: 'بعدی ➡️', data: `${callbackPrefix}:page:${page + 1}` });
        }

        for (const btn of navRow) {
            keyboard.text(btn.text, btn.data);
        }
        keyboard.row();
    }

    // Add back button if provided
    if (backCallback) {
        keyboard.text('🔙 بازگشت', backCallback);
    }

    return keyboard;
}

/**
 * Build confirmation keyboard
 */
export function buildConfirmationKeyboard(
    confirmCallback: string,
    cancelCallback: string,
    confirmText: string = '✅ تایید',
    cancelText: string = '❌ انصراف'
): InlineKeyboard {
    return new InlineKeyboard()
        .text(confirmText, confirmCallback)
        .text(cancelText, cancelCallback);
}

/**
 * Build simple back button keyboard
 */
export function buildBackButton(callback: string, text: string = '🔙 بازگشت'): InlineKeyboard {
    return new InlineKeyboard().text(text, callback);
}
