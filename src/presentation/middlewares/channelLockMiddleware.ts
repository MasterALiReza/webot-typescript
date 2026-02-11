import { Context, NextFunction } from 'grammy';
import { ChannelHandler } from '../handlers/admin/ChannelHandler';
import { logger } from '../../shared/logger';

/**
 * Middleware to check if user has joined required channels
 * Blocks interaction if not joined (except for specific allowed updates)
 */
export const channelLockMiddleware = async (ctx: Context, next: NextFunction) => {
    // Skip for channel posts or non-user updates
    if (!ctx.from || ctx.chat?.type === 'channel') {
        return next();
    }

    const userId = ctx.from.id;

    // Skip for admins (optional, but good for testing)
    // You might want to check admin list here or just let admins be checked too
    // For now, let's strictly check everyone to ensure it works

    // Allow /start command to go through up to a point, or block everything?
    // Usually we allow /start to run so we can send the "Join Channels" message.
    // BUT, if we block properly, we should send the message HERE and stop propagation.

    // Allow specific callback queries like 'check_membership'
    if (ctx.callbackQuery?.data === 'check_membership') {
        const isMember = await ChannelHandler.checkUserMembership(ctx, userId);
        if (isMember) {
            await ctx.answerCallbackQuery({ text: '✅ عضویت تایید شد. خوش آمدید!' });
            await ctx.deleteMessage(); // Delete the lock message
            // Optionally send welcome message or home menu
            // We can't easily jump to home menu handler from here without circular deps or complex logic
            // Best is to let user send /start again or provide a "Start" button
            return;
        } else {
            await ctx.answerCallbackQuery({ text: '❌ هنوز عضو همه کانال‌ها نشده‌اید!' });
            return; // Stop here
        }
    }

    // Check membership
    const isMember = await ChannelHandler.checkUserMembership(ctx, userId);

    if (isMember) {
        return next();
    }

    // User is NOT a member. Block and show lock message.

    // Get missing channels to show buttons
    const missingChannels = await ChannelHandler.getMissingChannels(ctx, userId);

    // Build keyboard
    const inlineKeyboard = [];
    missingChannels.forEach(channel => {
        inlineKeyboard.push([{ text: `📢 عضویت در ${channel.name}`, url: channel.link }]);
    });

    inlineKeyboard.push([{ text: '🔄 بررسی عضویت', callback_data: 'check_membership' }]);

    const message = `
⛔️ <b>عضویت اجباری</b>

برای استفاده از ربات، لطفاً در کانال‌های زیر عضو شوید و سپس دکمه <b>بررسی عضویت</b> را بزنید.
    `.trim();

    // If it's a callback query (not check_membership), answer it
    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⛔️ لطفاً ابتدا در کانال‌ها عضو شوید.' });
        // Optionally edit message to show lock again if needed
        return;
    }

    // Send lock message
    try {
        await ctx.reply(message, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });
    } catch (error) {
        logger.error('Error sending channel lock message:', error);
    }

    // Stop propagation
};
