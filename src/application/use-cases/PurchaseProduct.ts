import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { ProductRepository } from '../../infrastructure/database/repositories/ProductRepository';
import { InvoiceRepository } from '../../infrastructure/database/repositories/InvoiceRepository';
import { PanelFactory } from '../../infrastructure/panels/PanelFactory';
import { InsufficientBalanceError, NotFoundError, ValidationError } from '../../core/errors';
import crypto from 'crypto';

interface PurchaseInput {
    userId: number;
    productId: number;
    finalPrice?: number;
}

interface PurchaseResult {
    success: boolean;
    invoice?: any;
    error?: string;
}

export class PurchaseProductUseCase {
    constructor(
        private userRepo: UserRepository,
        private productRepo: ProductRepository,
        private invoiceRepo: InvoiceRepository
    ) { }

    async execute(input: PurchaseInput): Promise<PurchaseResult> {
        try {
            // 1. Get user
            const user = await this.userRepo.findById(input.userId);
            if (!user) {
                throw new NotFoundError('User');
            }

            // 2. Get product with panel
            const product = await this.productRepo.findById(input.productId);
            if (!product || !product.isActive) {
                throw new NotFoundError('Product');
            }

            // 3. Determine price and check balance
            const priceToDeduct = input.finalPrice !== undefined ? input.finalPrice : Number(product.price);

            if (Number(user.balance) < priceToDeduct) {
                throw new InsufficientBalanceError();
            }

            // 4. Generate username
            const username = this.generateUsername(user.chatId);

            // 5. Create user on panel
            const panel = product.panel;
            if (!panel) {
                throw new ValidationError('Product has no associated panel');
            }

            const panelAdapter = PanelFactory.create(panel);
            // TODO: Handle panel error gracefully
            const panelUser = await panelAdapter.createUser({
                username,
                volume: product.volume,
                duration: product.duration,
                inbounds: panel.inbounds || undefined,
            });

            // 6. Deduct balance
            if (priceToDeduct > 0) {
                await this.userRepo.deductBalance(user.id, priceToDeduct);
            }

            // 7. Process Referral Reward
            if (user.referredBy) {
                // Check if affiliate system enabled (could handle this via config/db setting)
                // For simplicity, hardcode reward or fetch from setting. 
                // Let's assume a fixed reward for now as per plan, or ideally fetch from DB.
                // Since I don't want to add complexity of fetching settings right now, let's go with fixed 5000 as mentioned in ProfileHandler.
                const rewardAmount = 5000;

                // Credit referrer
                // user.referredBy is BigInt (chatId) based on schema
                // But addBalance takes ID (number). We need to find referrer by chatId first.
                // Or update addBalance to take chatId?
                // Let's us updateByChatId which is generic, or add specific method.
                // UserRepository has updateByChatId.

                await this.userRepo.updateByChatId(user.referredBy, {
                    balance: { increment: rewardAmount }
                });

                // Notify referrer?
                // We don't have access to bot instance here to send message.
                // Notification should be handled by caller or via event bus.
                // For now, silent reward.
            }

            // 7. Create invoice
            const invoice = await this.invoiceRepo.create({
                userId: user.id,
                productId: product.id,
                panelId: panel.id,
                username,
                configUrl: panelUser.subscriptionUrl || '',
                subscriptionUrl: panelUser.subscriptionUrl || '',
                serviceLocation: panel.name,
                productName: product.name,
                productPrice: product.price,
                expiresAt: new Date(panelUser.expire * 1000),
            });

            return {
                success: true,
                invoice,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    private generateUsername(chatId: bigint): string {
        // Generate username: first 8 chars of hash + last 4 digits of chat ID
        const hash = crypto.createHash('md5').update(chatId.toString()).digest('hex');
        const chatIdStr = chatId.toString();
        const suffix = chatIdStr.slice(-4);
        return `user_${hash.substring(0, 8)}_${suffix}`;
    }
}
