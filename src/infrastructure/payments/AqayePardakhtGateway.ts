import axios, { AxiosInstance } from 'axios';
import { IPaymentGateway, PaymentResult, VerificationResult } from '../../core/interfaces/IPaymentGateway';
import { PaymentError } from '../../core/errors';

/**
 * AqayePardakht Payment Gateway
 * 
 * Iranian payment gateway based on original botmirzapanel implementation.
 * 
 * API Endpoints:
 * - Create payment: https://panel.aqayepardakht.ir/api/v2/create
 * - Verify payment: https://panel.aqayepardakht.ir/api/v2/verify
 * - Payment URL: https://panel.aqayepardakht.ir/startpay/{transid}
 * 
 * Error Codes:
 * -1: amount cannot be empty
 * -2: PIN code cannot be empty
 * -3: callback cannot be empty
 * -4: amount must be numeric
 * -5: amount must be between 1,000 to 100,000,000 Toman
 * -6: PIN code is incorrect
 * -7: transid cannot be empty
 * -8: Transaction not found
 * -9: PIN code doesn't match transaction gateway
 * -10: Amount doesn't match transaction amount
 * -11: Gateway is pending approval or inactive
 * -12: Cannot send request for this merchant
 * -13: Card number must be 16 continuous digits
 * -14: Gateway is being used on another website
 */
export class AqayePardakhtGateway implements IPaymentGateway {
    private client: AxiosInstance;
    private pin: string;
    private callbackUrl: string;

    constructor() {
        this.pin = process.env.AQAYEPARDAKHT_PIN || '';
        this.callbackUrl = process.env.AQAYEPARDAKHT_CALLBACK_URL || '';

        this.client = axios.create({
            baseURL: 'https://panel.aqayepardakht.ir/api/v2',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async createPayment(
        amount: number,
        userId: number,
        _metadata?: any
    ): Promise<PaymentResult> {
        try {
            if (!this.pin) {
                throw new PaymentError('AqayePardakht PIN not configured');
            }

            if (!this.callbackUrl) {
                throw new PaymentError('AqayePardakht callback URL not configured');
            }

            // Validate amount (between 1,000 to 100,000,000 Toman)
            if (amount < 1000 || amount > 100000000) {
                throw new PaymentError('Amount must be between 1,000 to 100,000,000 Toman');
            }

            const invoiceId = `${userId}_${Date.now()}`;

            const requestData = {
                pin: this.pin,
                amount: amount,
                callback: this.callbackUrl,
                invoice_id: invoiceId,
            };

            const response = await this.client.post('/create', requestData);

            if (response.data.status === 'success') {
                const transId = response.data.transid;
                const paymentUrl = `https://panel.aqayepardakht.ir/startpay/${transId}`;

                return {
                    paymentUrl,
                    trackingCode: transId,
                };
            } else {
                const errorMessage = this.getErrorMessage(response.data.code);
                throw new PaymentError(`AqayePardakht: ${errorMessage}`);
            }
        } catch (error: any) {
            if (error instanceof PaymentError) throw error;
            throw new PaymentError(`AqayePardakht createPayment error: ${error.message}`);
        }
    }

    async verifyPayment(
        trackingCode: string,
        data?: any
    ): Promise<VerificationResult> {
        try {
            if (!this.pin) {
                throw new PaymentError('AqayePardakht PIN not configured');
            }

            const amount = data?.amount;
            if (!amount) {
                throw new PaymentError('Amount is required for verification');
            }

            const verifyData = {
                pin: this.pin,
                amount: amount,
                transid: trackingCode,
            };

            const response = await this.client.post('/verify', verifyData);

            // code = 1 means successful payment
            if (response.data.code === '1' || response.data.code === 1) {
                return {
                    success: true,
                    amount: amount,
                    transactionId: trackingCode,
                };
            }

            // code = 2 means already verified
            if (response.data.code === '2' || response.data.code === 2) {
                throw new PaymentError('Transaction already verified and paid');
            }

            // code = 0 means payment failed
            if (response.data.code === '0' || response.data.code === 0) {
                return {
                    success: false,
                    amount: 0,
                    transactionId: trackingCode,
                };
            }

            // Other error codes
            const errorMessage = this.getErrorMessage(response.data.code);
            throw new PaymentError(`AqayePardakht verification failed: ${errorMessage}`);
        } catch (error: any) {
            if (error instanceof PaymentError) throw error;
            throw new PaymentError(`AqayePardakht verifyPayment error: ${error.message}`);
        }
    }

    async getPaymentStatus(_trackingCode: string): Promise<'pending' | 'completed' | 'failed'> {
        try {
            // AqayePardakht doesn't have a separate status endpoint
            // We can attempt to verify to check status, but this is not recommended
            // in production as it may mark the payment as verified
            // For now, return pending until actual verification
            return 'pending';
        } catch (error: any) {
            return 'failed';
        }
    }

    private getErrorMessage(code: string | number): string {
        const errorMessages: { [key: string]: string } = {
            '-1': 'amount cannot be empty',
            '-2': 'PIN code cannot be empty',
            '-3': 'callback cannot be empty',
            '-4': 'amount must be numeric',
            '-5': 'amount must be between 1,000 to 100,000,000 Toman',
            '-6': 'PIN code is incorrect',
            '-7': 'transid cannot be empty',
            '-8': 'Transaction not found',
            '-9': 'PIN code doesn\'t match transaction gateway',
            '-10': 'Amount doesn\'t match transaction amount',
            '-11': 'Gateway is pending approval or inactive',
            '-12': 'Cannot send request for this merchant',
            '-13': 'Card number must be 16 continuous digits',
            '-14': 'Gateway is being used on another website',
            '0': 'Payment was not completed',
            '2': 'Transaction already verified and paid',
        };

        return errorMessages[String(code)] || `Unknown error (code: ${code})`;
    }
}
