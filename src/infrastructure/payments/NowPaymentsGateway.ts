import axios, { AxiosInstance } from 'axios';
import { IPaymentGateway } from '../../core/interfaces/IPaymentGateway';
import { PaymentError } from '../../core/errors';

interface NowPaymentsCreateResponse {
    payment_id: string;
    payment_status: string;
    pay_address: string;
    price_amount: number;
    price_currency: string;
    pay_amount: number;
    pay_currency: string;
    order_id: string;
    order_description: string;
    ipn_callback_url?: string;
    created_at: string;
    updated_at: string;
    purchase_id: string;
    expiration_estimate_date: string;
}

interface NowPaymentsStatusResponse {
    payment_id: string;
    payment_status: string;
    pay_address: string;
    price_amount: number;
    price_currency: string;
    pay_amount: number;
    actually_paid: number;
    pay_currency: string;
    order_id: string;
    order_description: string;
    purchase_id: string;
    outcome_amount: number;
    outcome_currency: string;
}

export class NowPaymentsGateway implements IPaymentGateway {
    private client: AxiosInstance;
    private apiKey: string;
    private ipnCallbackUrl: string;

    constructor() {
        this.apiKey = process.env.NOWPAYMENTS_API_KEY || '';
        this.ipnCallbackUrl = process.env.NOWPAYMENTS_IPN_URL || '';

        this.client = axios.create({
            baseURL: 'https://api.nowpayments.io/v1',
            timeout: 30000,
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
        });
    }

    async createPayment(
        amount: number,
        userId: number,
        metadata?: any
    ): Promise<{ paymentUrl: string; trackingCode: string }> {
        try {
            // Convert IRR to USD (approximate rate, should be fetched from API)
            const usdAmount = (amount / 60000).toFixed(2); // تقریبی

            const response = await this.client.post<NowPaymentsCreateResponse>('/payment', {
                price_amount: parseFloat(usdAmount),
                price_currency: 'usd',
                pay_currency: metadata?.currency || 'btc', // BTC, ETH, USDT, etc.
                ipn_callback_url: this.ipnCallbackUrl,
                order_id: `user_${userId}_${Date.now()}`,
                order_description: `Wallet charge - User ${userId}`,
            });

            return {
                paymentUrl: response.data.pay_address, // Crypto address to send to
                trackingCode: response.data.payment_id,
            };
        } catch (error: any) {
            throw new PaymentError(`NowPayments createPayment error: ${error.message}`);
        }
    }

    async verifyPayment(
        trackingCode: string,
        _data: any
    ): Promise<{ success: boolean; amount: number; transactionId: string }> {
        try {
            const response = await this.client.get<NowPaymentsStatusResponse>(
                `/payment/${trackingCode}`
            );

            const status = response.data.payment_status;
            const success =
                status === 'finished' || status === 'confirmed' || status === 'sending';

            // Convert USD back to IRR
            const irrAmount = Math.floor(response.data.price_amount * 60000);

            return {
                success,
                amount: irrAmount,
                transactionId: trackingCode,
            };
        } catch (error: any) {
            throw new PaymentError(`NowPayments verifyPayment error: ${error.message}`);
        }
    }

    async getPaymentStatus(trackingCode: string): Promise<'pending' | 'completed' | 'failed'> {
        try {
            const response = await this.client.get<NowPaymentsStatusResponse>(
                `/payment/${trackingCode}`
            );

            const status = response.data.payment_status;

            if (status === 'finished' || status === 'confirmed') {
                return 'completed';
            } else if (status === 'failed' || status === 'expired' || status === 'refunded') {
                return 'failed';
            }

            return 'pending';
        } catch (error: any) {
            throw new PaymentError(`NowPayments getPaymentStatus error: ${error.message}`);
        }
    }
}
