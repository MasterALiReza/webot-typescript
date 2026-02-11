import { IPaymentGateway } from '../../core/interfaces/IPaymentGateway';
import { PaymentError } from '../../core/errors';

/**
 * Card-to-Card Payment Gateway (Manual Verification)
 * 
 * This gateway requires admin manual verification.
 * User uploads receipt → Admin approves → Balance charged
 */
export class CardToCardGateway implements IPaymentGateway {
    private cardNumber: string;
    private cardHolder: string;

    constructor() {
        this.cardNumber = process.env.CARD_TO_CARD_NUMBER || '6037-9977-1234-5678';
        this.cardHolder = process.env.CARD_TO_CARD_HOLDER || 'علی احمدی';
    }

    async createPayment(
        amount: number,
        userId: number,
        _metadata?: any
    ): Promise<{ paymentUrl: string; trackingCode: string }> {
        // Generate a unique tracking code
        const trackingCode = `C2C_${userId}_${Date.now()}`;

        // Return card info as "payment URL" (will be displayed to user)
        const paymentInfo = {
            cardNumber: this.cardNumber,
            cardHolder: this.cardHolder,
            amount: amount.toLocaleString('fa-IR'),
            trackingCode,
        };

        return {
            paymentUrl: JSON.stringify(paymentInfo),
            trackingCode,
        };
    }

    async verifyPayment(
        trackingCode: string,
        data: any
    ): Promise<{ success: boolean; amount: number; transactionId: string }> {
        // Card-to-card requires manual admin verification
        // This method is called after admin approval

        if (data.adminApproved) {
            return {
                success: true,
                amount: data.amount,
                transactionId: trackingCode,
            };
        }

        throw new PaymentError('Card-to-card payment requires admin approval');
    }

    async getPaymentStatus(_trackingCode: string): Promise<'pending' | 'completed' | 'failed'> {
        // Always pending until admin manually verifies
        // Status should be checked from payment_reports table
        return 'pending';
    }

    getCardInfo(): { cardNumber: string; cardHolder: string } {
        return {
            cardNumber: this.cardNumber,
            cardHolder: this.cardHolder,
        };
    }
}
