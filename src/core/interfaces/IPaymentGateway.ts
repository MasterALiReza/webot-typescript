// Payment gateway interface
export interface PaymentResult {
    paymentUrl: string;
    trackingCode: string;
}

export interface VerificationResult {
    success: boolean;
    amount: number;
    transactionId: string;
}

export interface IPaymentGateway {
    /**
     * Create a new payment request
     */
    createPayment(amount: number, userId: number, metadata?: any): Promise<PaymentResult>;

    /**
     * Verify a payment transaction
     */
    verifyPayment(trackingCode: string, data?: any): Promise<VerificationResult>;

    /**
     * Get payment status
     */
    getPaymentStatus(trackingCode: string): Promise<'pending' | 'completed' | 'failed'>;
}
