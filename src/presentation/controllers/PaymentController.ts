
import { Request, Response, Router } from 'express';
import { Bot } from 'grammy';
import { PaymentFactory } from '../../infrastructure/payments/PaymentFactory';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../shared/logger';


export class PaymentController {
    public router: Router;
    private bot: Bot;

    constructor(bot: Bot) {
        this.router = Router();
        this.bot = bot;
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get('/callback/zarinpal', (req, res) => this.handleZarinpalCallback(req, res));
        // Add other callbacks here
    }

    /**
     * Handle Zarinpal Callback
     * Request query: ?Authority=...&Status=...
     */
    private async handleZarinpalCallback(req: Request, res: Response) {
        const { Authority, Status } = req.query;

        if (Status !== 'OK') {
            return res.send(this.getHtmlTemplate('پرداخت ناموفق', '❌ پرداخت توسط کاربر لغو شد یا با خطا مواجه گردید.', 'red'));
        }

        try {
            // Find the pending payment report using tracking code (Authority)
            const payment = await prisma.paymentReport.findFirst({
                where: { transactionId: String(Authority), status: 'PENDING' }
            });

            if (!payment) {
                logger.warn(`Payment not found for Authority: ${Authority}`);
                return res.send(this.getHtmlTemplate('خطای پرداخت', '❌ اطلاعات پرداخت یافت نشد.', 'red'));
            }

            // Verify with Zarinpal
            const gateway = PaymentFactory.create('zarinpal');
            const verifyResult = await gateway.verifyPayment(String(Authority), { amount: Number(payment.amount) });

            if (verifyResult.success) {
                // Update User Balance
                await prisma.user.update({
                    where: { id: payment.userId },
                    data: { balance: { increment: payment.amount } }
                });

                // Update Payment Report
                await prisma.paymentReport.update({
                    where: { id: payment.id },
                    data: {
                        status: 'PAID',
                        transactionId: verifyResult.transactionId, // Update with RefID
                        description: `پرداخت آنلاین موفق - RefID: ${verifyResult.transactionId}`
                    }
                });

                // Notify User
                const user = await prisma.user.findUnique({ where: { id: payment.userId } });
                if (user && user.chatId) {
                    await this.bot.api.sendMessage(
                        Number(user.chatId),
                        `✅ <b>پرداخت موفق</b>\n\n` +
                        `مبلغ ${Number(payment.amount).toLocaleString('fa-IR')} تومان به کیف پول شما اضافه شد.\n` +
                        `کد پیگیری: ${verifyResult.transactionId}`,
                        { parse_mode: 'HTML' }
                    );
                }

                return res.send(this.getHtmlTemplate('پرداخت موفق', '✅ کیف پول شما با موفقیت شارژ شد. می‌توانید به ربات بازگردید.', 'green'));
            } else {
                await prisma.paymentReport.update({
                    where: { id: payment.id },
                    data: { status: 'FAILED' }
                });
                return res.send(this.getHtmlTemplate('پرداخت ناموفق', '❌ عملیات پرداخت تایید نشد.', 'red'));
            }

        } catch (error) {
            logger.error('Error in Zarinpal Callback:', error);
            return res.send(this.getHtmlTemplate('خطای سیستمی', '❌ خطایی در پردازش رخ داد.', 'red'));
        }
    }

    private getHtmlTemplate(title: string, message: string, color: string): string {
        return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    body { font-family: Tahoma, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f4; }
                    .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 500px; margin: auto; }
                    h1 { color: ${color}; }
                    p { font-size: 18px; color: #333; }
                    .btn { display: inline-block; padding: 10px 20px; margin-top: 20px; background-color: #0088cc; color: white; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>${title}</h1>
                    <p>${message}</p>
                    <a href="https://t.me/${this.bot.botInfo.username}" class="btn">بازگشت به ربات</a>
                </div>
            </body>
            </html>
        `;
    }
}
