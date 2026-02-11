import { Context, NextFunction } from 'grammy';
import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';

const userRepo = new UserRepository();

export async function userBlockCheckMiddleware(ctx: Context, next: NextFunction) {
    if (!ctx.from) return next();

    const user = await userRepo.findByChatId(BigInt(ctx.from.id));

    if (user && user.userStatus === 'BLOCKED') {
        const message = user.descriptionBlocking || '⛔️ شما از استفاده از ربات محروم شده‌اید.';
        await ctx.reply(message);
        return; // Don't call next()
    }

    return next();
}
