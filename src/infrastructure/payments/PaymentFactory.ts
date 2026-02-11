import { IPaymentGateway } from '../../core/interfaces/IPaymentGateway';
import { ZarinpalGateway } from './ZarinpalGateway';
import { NowPaymentsGateway } from './NowPaymentsGateway';
import { CardToCardGateway } from './CardToCardGateway';

export type PaymentMethod = 'zarinpal' | 'nowpayments' | 'cardtocard';

export class PaymentFactory {
    /**
     * Create payment gateway by method name
     */
    static create(method: PaymentMethod): IPaymentGateway {
        switch (method) {
            case 'zarinpal':
                return new ZarinpalGateway();

            case 'nowpayments':
                return new NowPaymentsGateway();

            case 'cardtocard':
                return new CardToCardGateway();

            default:
                throw new Error(`Unknown payment method: ${method}`);
        }
    }

    /**
     * Get all available payment methods
     */
    static getAvailableMethods(): PaymentMethod[] {
        const methods: PaymentMethod[] = ['cardtocard']; // Always available

        // Check if Zarinpal is configured
        if (process.env.ZARINPAL_MERCHANT_ID) {
            methods.push('zarinpal');
        }

        // Check if NowPayments is configured
        if (process.env.NOWPAYMENTS_API_KEY) {
            methods.push('nowpayments');
        }

        return methods;
    }
}
