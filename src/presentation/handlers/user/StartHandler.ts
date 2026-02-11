import { Context } from 'grammy';
import { UserRepository } from '../../../infrastructure/database/repositories/UserRepository';

const userRepo = new UserRepository();

export class StartHandler {
    async handle(ctx: Context) {
        if (!ctx.from) return;

        const user = await userRepo.findByChatId(BigInt(ctx.from.id));
        if (!user) return;

        // Check for referral code in /start command
        const startPayload = ctx.match;
        if (startPayload && typeof startPayload === 'string' && startPayload.startsWith('ref_')) {
            const refCode = startPayload.substring(4);
            await this.processReferral(ctx, user.id, refCode);
        }

        const keyboard = this.buildMainKeyboard();

        await ctx.reply(
            `👋 سلام ${user.firstName || 'کاربر'}!\n\n` +
            `به ربات فروش سرویس VPN خوش آمدید.\n\n` +
            `💰 موجودی شما: ${user.balance} تومان\n` +
            `👤 شناسه کاربری: ${user.chatId}\n\n` +
            `از منوی زیر گزینه مورد نظر خود را انتخاب کنید:`,
            {
                reply_markup: keyboard,
            }
        );
    }

    private async processReferral(ctx: Context, userId: number, refCode: string) {
        const referrer = await userRepo.findByRefCode(refCode);

        if (!referrer || referrer.id === userId) {
            return; // Invalid ref code or self-referral
        }

        // Check if user already has a referrer
        const user = await userRepo.findById(userId);
        if (user && user.referredBy) {
            return; // Already referred by someone
        }

        // Update referrer
        await userRepo.incrementAffiliateCount(referrer.id);
        await userRepo.addBalance(referrer.id, 5000); // 5000 تومان پاداش

        // Update user
        await userRepo.update(userId, { referredBy: referrer.chatId });

        await ctx.reply(
            `✅ شما از طریق لینک دعوت کاربر ${referrer.firstName || 'ناشناس'} وارد شدید!\n` +
            `🎁 ${referrer.firstName} 5000 تومان پاداش دریافت کرد.`
        );
    }

    private buildMainKeyboard() {
        return {
            keyboard: [
                [{ text: '🛒 خرید سرویس' }, { text: '📦 سرویس‌های من' }],
                [{ text: '💰 کیف پول' }, { text: '👤 پروفایل' }],
                [{ text: '🎫 پشتیبانی' }, { text: '❓ راهنما' }],
            ],
            resize_keyboard: true,
            persistent: true,
        };
    }
}
