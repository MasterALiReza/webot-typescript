import { Context, NextFunction } from 'grammy';
import { config } from '../../shared/config';
import { logger } from '../../shared/logger';

/**
 * Admin Authentication Middleware
 * Checks if the user is authorized to access admin commands
 */
export function adminAuthMiddleware() {
    return async (ctx: Context, next: NextFunction) => {
        const userId = ctx.from?.id;

        if (!userId) {
            logger.warn('Admin auth failed: No user ID');
            return;
        }

        // Parse admin IDs from config
        const adminIds = config.ADMIN_CHAT_ID
            .split(',')
            .map(id => BigInt(id.trim()));

        // Check if user is admin
        if (!adminIds.includes(BigInt(userId))) {
            logger.warn(`Unauthorized admin access attempt by user ${userId}`);
            await ctx.reply('⛔️ شما دسترسی به پنل ادمین ندارید.');
            return;
        }

        logger.info(`Admin access granted to user ${userId}`);
        await next();
    };
}
