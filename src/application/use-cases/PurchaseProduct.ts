import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { ProductRepository } from '../../infrastructure/database/repositories/ProductRepository';
import { InvoiceRepository } from '../../infrastructure/database/repositories/InvoiceRepository';
import { PanelFactory } from '../../infrastructure/panels/PanelFactory';
import { InsufficientBalanceError, NotFoundError, ValidationError } from '../../core/errors';
import crypto from 'crypto';

interface PurchaseInput {
    userId: number;
    productId: number;
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

            // 3. Check balance
            const price = Number(product.price);
            if (Number(user.balance) < price) {
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
            const panelUser = await panelAdapter.createUser({
                username,
                volume: product.volume,
                duration: product.duration,
                inbounds: panel.inbounds || undefined,
            });

            // 6. Deduct balance
            await this.userRepo.deductBalance(user.id, price);

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
