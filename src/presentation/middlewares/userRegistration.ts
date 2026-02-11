import { Context, NextFunction } from 'grammy';
import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';

const userRepo = new UserRepository();

export async function userRegistrationMiddleware(ctx: Context, next: NextFunction) {
    if (!ctx.from) return next();

    const chatId = BigInt(ctx.from.id);
    let user = await userRepo.findByChatId(chatId);

    if (!user) {
        // Auto-register new user
        user = await userRepo.create({
            chatId,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
        });
    }

    return next();
}
