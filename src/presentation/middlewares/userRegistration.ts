import { Context, NextFunction } from 'grammy';
import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';

const userRepo = new UserRepository();

export async function userRegistrationMiddleware(ctx: Context, next: NextFunction) {
    if (!ctx.from) return next();

    const chatId = BigInt(ctx.from.id);
    let user = await userRepo.findByChatId(chatId);

    if (!user) {
        let referredBy: bigint | undefined;

        // Check for referral code in start payload
        if (ctx.message?.text?.startsWith('/start ref_')) {
            const refCode = ctx.message.text.split('ref_')[1];
            if (refCode) {
                const referrer = await userRepo.findByRefCode(refCode);
                if (referrer && referrer.chatId !== chatId) {
                    referredBy = referrer.chatId;

                    // Increment referrer's affiliate count
                    // We use chatId for increment now based on repo update
                    await userRepo.incrementAffiliateCount(referrer.chatId);

                    // Notify referrer
                    try {
                        await ctx.api.sendMessage(
                            Number(referrer.chatId),
                            `🎉 یک کاربر جدید با لینک دعوت شما عضو شد!\n👤 نام: ${ctx.from.first_name}`
                        );
                    } catch (err) {
                        // Ignore if blocked or fails
                    }
                }
            }
        }

        // Auto-register new user
        user = await userRepo.create({
            chatId,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            referredBy
        });
    }

    return next();
}
