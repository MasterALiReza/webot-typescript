import axios, { AxiosInstance } from 'axios';
import { IPaymentGateway } from '../../core/interfaces/IPaymentGateway';
import { PaymentError } from '../../core/errors';
import { loadConfig } from '../../shared/config';

const config = loadConfig();

interface ZarinpalPaymentResponse {
    data: {
        code: number;
        message: string;
        authority?: string;
    };
    errors: any[];
}

interface ZarinpalVerifyResponse {
    data: {
        code: number;
        message: string;
        ref_id?: number;
        card_pan?: string;
    };
    errors: any[];
}

export class ZarinpalGateway implements IPaymentGateway {
    private client: AxiosInstance;
    private merchantId: string;
    private callbackUrl: string;
    private sandbox: boolean;

    constructor() {
        this.merchantId = process.env.ZARINPAL_MERCHANT_ID || '';
        this.callbackUrl = process.env.ZARINPAL_CALLBACK_URL || '';
        this.sandbox = config.NODE_ENV === 'development';

        const baseURL = this.sandbox
            ? 'https://sandbox.zarinpal.com/pg/v4/payment'
            : 'https://payment.zarinpal.com/pg/v4/payment';

        this.client = axios.create({
            baseURL,
            timeout: 30000,
            headers: {
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
            const response = await this.client.post<ZarinpalPaymentResponse>('/request.json', {
                merchant_id: this.merchantId,
                amount: amount * 10, // تومان به ریال
                description: `شارژ کیف پول - کاربر ${userId}`,
                callback_url: this.callbackUrl,
                metadata: {
                    mobile: metadata?.mobile || '',
                    email: metadata?.email || '',
                },
            });

            if (response.data.data.code !== 100 || !response.data.data.authority) {
                throw new PaymentError(`Zarinpal error: ${response.data.data.message}`);
            }

            const authority = response.data.data.authority;
            const paymentUrl = this.sandbox
                ? `https://sandbox.zarinpal.com/pg/Start

Pay/${authority}`
                : `https://www.zarinpal.com/pg/StartPay/${authority}`;

            return {
                paymentUrl,
                trackingCode: authority,
            };
        } catch (error: any) {
            if (error instanceof PaymentError) throw error;
            throw new PaymentError(`Zarinpal createPayment error: ${error.message}`);
        }
    }

    async verifyPayment(
        trackingCode: string,
        data: any
    ): Promise<{ success: boolean; amount: number; transactionId: string }> {
        try {
            const response = await this.client.post<ZarinpalVerifyResponse>('/verify.json', {
                merchant_id: this.merchantId,
                authority: trackingCode,
                amount: data.amount * 10, // تومان به ریال
            });

            if (response.data.data.code === 100 || response.data.data.code === 101) {
                return {
                    success: true,
                    amount: data.amount,
                    transactionId: response.data.data.ref_id?.toString() || trackingCode,
                };
            }

            return {
                success: false,
                amount: 0,
                transactionId: trackingCode,
            };
        } catch (error: any) {
            throw new PaymentError(`Zarinpal verifyPayment error: ${error.message}`);
        }
    }

    async getPaymentStatus(_trackingCode: string): Promise<'pending' | 'completed' | 'failed'> {
        // Zarinpal doesn't have a direct status check API
        // Status is determined during verification
        return 'pending';
    }
}
