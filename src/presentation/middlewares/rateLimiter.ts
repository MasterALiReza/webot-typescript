import { Context, NextFunction } from 'grammy';
import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';

const userRepo = new UserRepository();

export async function rateLimiterMiddleware(ctx: Context, next: NextFunction) {
    if (!ctx.from) return next();

    const user = await userRepo.findByChatId(BigInt(ctx.from.id));
    if (!user) return next();

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - user.lastMessageTime;

    // Reset counter if more than 60 seconds passed
    if (elapsed >= 60) {
        await userRepo.resetMessageCount(user.id, now);
    } else {
        // Check if user exceeded limit
        const limit = 10; // TODO: Get from bot settings
        if (user.messageCount >= limit) {
            await ctx.reply('⚠️ تعداد پیام‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.');
            return; // Don't call next()
        }
        await userRepo.incrementMessageCount(user.id);
    }

    return next();
}
