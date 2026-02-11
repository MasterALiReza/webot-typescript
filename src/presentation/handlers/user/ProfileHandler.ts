
import { Context } from 'grammy';
import { UserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { getProfileMenuKeyboard } from '../../keyboards/userKeyboards';

import { logger } from '../../../shared/logger';

const userRepo = new UserRepository();

export class ProfileHandler {
    /**
     * Show user profile
     */
    async showProfile(ctx: Context) {
        try {
            if (!ctx.from) return;

            const user = await userRepo.findByChatId(BigInt(ctx.from.id));
            if (!user) {
                await ctx.reply('❌ کاربر یافت نشد. لطفا مجدد /start را ارسال کنید.');
                return;
            }

            const stats = await this.getUserStats(user.id);

            const message = `👤 ** پروفایل کاربری **\n\n` +
                `🆔 شناسه: \`${user.chatId}\`\n` +
                `👤 نام: ${user.firstName || 'تنظیم نشده'}\n` +
                `📱 شماره: ${user.phoneNumber || 'تنظیم نشده'}\n` +
                `💰 موجودی: ${user.balance.toLocaleString()} تومان\n` +
                `📅 تاریخ عضویت: ${user.createdAt.toLocaleDateString('fa-IR')}\n\n` +
                `📊 **آمار شما:**\n` +
                `📦 سرویس‌های فعال: ${stats.activeServices}\n` +
                `👥 زیرمجموعه‌ها: ${stats.referrals}\n` +
                `💸 درآمد از دعوت: ${stats.referralIncome.toLocaleString()} تومان`;

            await ctx.reply(message, {
                reply_markup: getProfileMenuKeyboard(),
            });
        } catch (error) {
            logger.error('Error in showProfile:', error);
            await ctx.reply('❌ خطا در نمایش پروفایل');
        }
    }

    /**
     * Show referral code
     */
    async showReferralCode(ctx: Context) {
        try {
            if (!ctx.from) return;

            const user = await userRepo.findByChatId(BigInt(ctx.from.id));
            if (!user) return;

            // Use bot username from context if available, otherwise fallback
            const botUsername = ctx.me?.username || 'MirzaVPNBot';
            const referralLink = `https://t.me/${botUsername}?start=ref_${user.referralCode}`;

            await ctx.reply(
                `👥 **لینک دعوت اختصاصی شما**\n\n` +
                `با اشتراک‌گذاری لینک زیر، دوستان خود را دعوت کنید و پاداش بگیرید!\n\n` +
                `🔗 لینک شما:\n\`${referralLink}\`\n\n` +
                `🎁 پاداش دعوت: 5000 تومان برای هر کاربر`,
                {
                    parse_mode: 'Markdown',
                }
            );
        } catch (error) {
            logger.error('Error in showReferralCode:', error);
            await ctx.reply('❌ خطا در نمایش کد دعوت');
        }
    }

    private async getUserStats(userId: number) {
        // This would ideally come from a repo method aggregating data
        // For now returning mock/basic data calculated from repo if methods exist
        // or just placeholders until those repo methods are implemented
        return {
            activeServices: 0, // database query needed
            referrals: await userRepo.getReferralCount(userId).catch(() => 0),
            referralIncome: 0, // database query needed
        };
    }
}
