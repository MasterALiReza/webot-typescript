import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { ProductRepository } from '../../infrastructure/database/repositories/ProductRepository';
import { PanelFactory } from '../../infrastructure/panels/PanelFactory';
import { InsufficientBalanceError, NotFoundError, ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';
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
        private productRepo: ProductRepository
    ) { }

    async execute(input: PurchaseInput): Promise<PurchaseResult> {
        let panelUsername: string | null = null;
        let panel: any = null;

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

            panel = product.panel;
            if (!panel) {
                throw new ValidationError('Product has no associated panel');
            }

            // 3. Determine price and check balance
            const priceToDeduct = input.finalPrice !== undefined ? input.finalPrice : Number(product.price);

            if (Number(user.balance) < priceToDeduct) {
                throw new InsufficientBalanceError();
            }

            // 4. Generate username
            const username = this.generateUsername(user.chatId);
            panelUsername = username;

            // 5. Create user on panel FIRST (before deducting balance)
            const panelAdapter = PanelFactory.create(panel);
            const panelUser = await panelAdapter.createUser({
                username,
                volume: product.volume,
                duration: product.duration,
                inbounds: panel.inbounds || undefined,
            });

            // 6. Use Prisma transaction for atomic DB operations
            const invoice = await prisma.$transaction(async (tx) => {
                // Deduct balance atomically
                if (priceToDeduct > 0) {
                    const balanceUpdate = await tx.user.updateMany({
                        where: {
                            id: user.id,
                            balance: { gte: priceToDeduct }
                        },
                        data: { balance: { decrement: priceToDeduct } },
                    });

                    if (balanceUpdate.count === 0) {
                        throw new InsufficientBalanceError();
                    }
                }

                // Process Referral Reward
                if (user.referredBy) {
                    const rewardAmount = 5000;
                    await tx.user.updateMany({
                        where: { chatId: user.referredBy },
                        data: { balance: { increment: rewardAmount } }
                    });
                }

                // Create invoice
                return await tx.invoice.create({
                    data: {
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
                    },
                });
            });

            return {
                success: true,
                invoice,
            };
        } catch (error: any) {
            // Rollback: Remove user from panel if DB transaction failed
            if (panelUsername && panel) {
                try {
                    const panelAdapter = PanelFactory.create(panel);
                    await panelAdapter.removeUser(panelUsername);
                } catch (rollbackError) {
                    // Log rollback failure but don't throw
                    console.error('Failed to rollback panel user:', rollbackError);
                }
            }

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
