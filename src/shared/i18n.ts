import faTexts from '../locales/fa.json';

/**
 * i18n System - Text localization and formatting utilities
 */

type TextKey = string;
type Variables = Record<string, string | number>;

/**
 * Get localized text by key with optional variable replacement
 * 
 * @param key - Dot notation key (e.g., 'menu.main', 'purchase.success')
 * @param vars - Variables to replace in text (e.g., {name}, {amount})
 * @returns Localized text with variables replaced
 * 
 * @example
 * t('start.welcome', { name: 'علی' })
 * // Returns: "سلام علی عزیز! 👋..."
 */
export function t(key: TextKey, vars?: Variables): string {
    // Navigate through nested object using dot notation
    const keys = key.split('.');
    let text: any = faTexts;

    for (const k of keys) {
        if (text && typeof text === 'object' && k in text) {
            text = text[k];
        } else {
            // Key not found, return the key itself as fallback
            return key;
        }
    }

    // If text is not a string, return key
    if (typeof text !== 'string') {
        return key;
    }

    // Replace variables if provided
    if (vars) {
        return replaceVariables(text, vars);
    }

    return text;
}

/**
 * Replace variables in template string
 * Variables format: {varName}
 */
function replaceVariables(template: string, vars: Variables): string {
    let result = template;

    for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`{${key}}`, 'g');
        result = result.replace(regex, String(value));
    }

    return result;
}

/**
 * Format number as Persian currency
 * 
 * @example
 * formatCurrency(50000)
 * // Returns: "۵۰,۰۰۰ تومان"
 */
export function formatCurrency(amount: number): string {
    return amount.toLocaleString('fa-IR') + ' تومان';
}

/**
 * Format date as Persian date
 * 
 * @example
 * formatDate(new Date())
 * // Returns: "۱۴۰۳/۱۱/۲۲"
 */
export function formatDate(date: Date): string {
    return date.toLocaleDateString('fa-IR');
}

/**
 * Format date and time as Persian
 * 
 * @example
 * formatDateTime(new Date())
 * // Returns: "۱۴۰۳/۱۱/۲۲ - ۱۴:۳۰"
 */
export function formatDateTime(date: Date): string {
    return date.toLocaleString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format bytes to GB/MB with Persian numerals
 * 
 * @example
 * formatBytes(5368709120)
 * // Returns: "۵ GB"
 */
export function formatBytes(bytes: number): string {
    const gb = bytes / (1024 ** 3);
    const mb = bytes / (1024 ** 2);

    if (gb >= 1) {
        return `${Number(gb.toFixed(2)).toLocaleString('fa-IR')} GB`;
    } else {
        return `${Number(mb.toFixed(2)).toLocaleString('fa-IR')} MB`;
    }
}

/**
 * Format duration in days to Persian text
 * 
 * @example
 * formatDuration(30)
 * // Returns: "۳۰ روز"
 */
export function formatDuration(days: number): string {
    return `${days.toLocaleString('fa-IR')} روز`;
}

/**
 * Get service status text
 */
export function getServiceStatusText(status: string): string {
    const statusMap: Record<string, string> = {
        ACTIVE: t('service.active'),
        EXPIRED: t('service.expired'),
        PENDING: t('service.pending'),
        DISABLED: t('service.disabled'),
    };

    return statusMap[status] || status;
}

/**
 * Create error message
 */
export function createErrorMessage(error: string | Error): string {
    if (typeof error === 'string') {
        return `${t('errors.general')}\n\n${error}`;
    }

    return t('errors.general');
}
