# راهنمای سیستم پرداخت

این سند راهنمای کامل پیکربندی و استفاده از 4 درگاه پرداخت پشتیبانی شده در WeBot است.

---

## فهرست مطالب

1. [Zarinpal (زرین‌پال)](#1-zarinpal-زرین‌پال)
2. [AqayePardakht (آقای پرداخت)](#2-aqayepardakht-آقای-پرداخت)
3. [Card-to-Card (کارت به کارت)](#3-card-to-card-کارت-به-کارت)
4. [NowPayments (پرداخت رمزارز)](#4-nowpayments-پرداخت-رمزارز)

---

## 1. Zarinpal (زرین‌پال)

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- درگاه بانکی ایرانی
- پشتیبانی از Sandbox برای توسعه
- تبدیل خودکار تومان به ریال
- دریافت authority برای tracking
- Verify با ref_id

### تنظیمات محیطی

```env
ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ZARINPAL_CALLBACK_URL=https://yourdomain.com/api/payment/zarinpal/callback
NODE_ENV=development  # برای فعال کردن sandbox
```

### مثال استفاده

```typescript
const gateway = PaymentFactory.create('zarinpal');

// ایجاد پرداخت
const result = await gateway.createPayment(
  50000, // تومان
  userId,
  { mobile: '09123456789', email: 'user@example.com' }
);

console.log('Payment URL:', result.paymentUrl);
console.log('Authority:', result.trackingCode);

// بعد از callback
const verification = await gateway.verifyPayment(authority, { amount: 50000 });
if (verification.success) {
  console.log('Ref ID:', verification.transactionId);
}
```

### نکات مهم

- Sandbox URL: `https://sandbox.zarinpal.com`
- Production URL: `https://payment.zarinpal.com`
- مبلغ باید به ریال تبدیل شود (× 10)

---

## 2. AqayePardakht (آقای پرداخت)

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- درگاه ایرانی  
- API v2
- PIN-based authentication
- محدوده مبلغ: 1,000 تا 100,000,000 تومان
- 14 error code مختلف

### تنظیمات محیطی

```env
AQAYEPARDAKHT_PIN=your-api-pin-code
AQAYEPARDAKHT_CALLBACK_URL=https://yourdomain.com/api/payment/aqayepardakht/callback
```

### مثال استفاده

```typescript
const gateway = PaymentFactory.create('aqayepardakht');

// ایجاد پرداخت
const result = await gateway.createPayment(
  25000, // تومان
  userId
);

console.log('Payment URL:', result.paymentUrl);
console.log('Trans ID:', result.trackingCode);

// بعد از callback
const verification = await gateway.verifyPayment(
  transId,
  { amount: 25000 }
);

if (verification.success) {
  console.log('Payment verified!');
}
```

### Error Codes

| Code | معنی |
|------|------|
| -1 | amount نمی‌تواند خالی باشد |
| -2 | کد پین درگاه نمی‌تواند خالی باشد |
| -3 | callback نمی‌تواند خالی باشد |
| -4 | amount باید عددی باشد |
| -5 | amount باید بین 1,000 تا 100,000,000 تومان باشد |
| -6 | کد پین درگاه اشتباه است |
| -11 | درگاه در انتظار تایید یا غیرفعال است |
| 1 | پرداخت موفق |
| 2 | تراکنش قبلاً verify شده |

### نکات مهم

- API Base URL: `https://panel.aqayepardakht.ir/api/v2`
- Payment URL: `https://panel.aqayepardakht.ir/startpay/{transid}`
- مبلغ به تومان (نه ریال)

---

## 3. Card-to-Card (کارت به کارت)

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- انتقال دستی
- بدون نیاز به API خارجی 
- آپلود رسید
- تایید دستی admin یا خودکار

### تنظیمات محیطی

```env
CARD_TO_CARD_NUMBER=6037-9977-1234-5678
CARD_TO_CARD_HOLDER=علی احمدی
CARD_TO_CARD_BANK=ملی
```

### فرایند کاربر

1. انتخاب "کارت به کارت"
2. مشاهده شماره کارت
3. واریز مبلغ
4. آپلود تصویر رسید
5. انتظار برای تایید admin
6. شارژ خودکار بعد از تایید

### مثال استفاده

```typescript
const gateway = PaymentFactory.create('cardtocard');

// دریافت اطلاعات کارت
const result = await gateway.createPayment(
  50000,
  userId
);

console.log('Card Number:', result.paymentUrl); // شماره کارت
console.log('Tracking:', result.trackingCode);

// بعد از آپلود رسید توسط user
await gateway.verifyPayment(trackingCode, {
  adminApproved: true,
  receiptPhotoId: 'file_id_from_telegram',
});
```

### Admin Panel

ادمین می‌تواند:
1. لیست پرداخت‌های در انتظار را ببیند
2. تصویر رسید را مشاهده کند
3. تایید یا رد کند

---

## 4. NowPayments (پرداخت رمزارز)

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- پرداخت با ارزهای دیجیتال
- 150+ ارز پشتیبانی شده
- تبدیل خودکار ریال به دلار
- IPN Callback
- Underpayment protection

### تنظیمات محیطی

```env
NOWPAYMENTS_API_KEY=your-api-key
NOWPAYMENTS_IPN_SECRET=your-ipn-secret
NOWPAYMENTS_IPN_URL=https://yourdomain.com/api/payment/nowpayments/ipn
```

### ارزهای محبوب

- BTC (Bitcoin)
- ETH (Ethereum)  
- USDT (Tether)
- TRX (Tron)
- LTC (Litecoin)

### مثال استفاده

```typescript
const gateway = PaymentFactory.create('nowpayments');

// ایجاد invoice
const result = await gateway.createPayment(
  50000, // تومان
  userId,
  { currency: 'USDTTRC20' }
);

console.log('Payment URL:', result.paymentUrl);
console.log('Invoice ID:', result.trackingCode);

// IPN webhook handle
app.post('/ipn', (req, res) => {
  const { payment_id, payment_status } = req.body;
  
  if (payment_status === 'finished') {
    // پرداخت موفق
  }
});
```

### Status های مختلف

| Status | معنی | نتیجه |
|--------|------|-------|
| `waiting` | در انتظار | pending |
| `confirming` | در حال تایید | pending |
| `confirmed` | تایید شده | completed |
| `sending` | در حال ارسال | completed |
| `partially_paid` | پرداخت ناقص | pending |
| `finished` | تمام شده | completed |
| `failed` | ناموفق | failed |
| `refunded` | بازگشت داده شده | failed |
| `expired` | منقضی شده | failed |

### نکات مهم

- نرخ تبدیل: 1 USD ≈ 60,000 تومان (قابل تغییر)
- حداقل مبلغ: 2 USD
- Callback از طریق IPN webhook

---

## معماری کلی

```
┌─────────────────────────────────────────┐
│         PaymentFactory                  │
│  ┌───────────────────────────────────┐  │
│  │  create(method)  → IPaymentGateway│  │
│  │  getAvailableMethods() → string[] │  │
│  └───────────────────────────────────┘  │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┬────────┬──────────┐
       │               │        │          │
┌──────▼──────┐ ┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
│  Zarinpal   │ │AqayePardakht│ │CardToCard│ │ NowPayments │
│   Gateway   │ │   Gateway   │ │ Gateway │ │   Gateway   │
└─────────────┘ └─────────────┘ └─────────┘ └─────────────┘
       │               │              │          │
       └───────┬───────┴──────────────┴──────────┘
               │
       ┌───────▼───────────────────────────┐
       │    IPaymentGateway                │
       │  - createPayment(amount, userId)  │
       │  - verifyPayment(trackingCode)    │
       │  - getPaymentStatus(trackingCode) │
       └───────────────────────────────────┘
```

---

## Interface یکپارچه

```typescript
interface IPaymentGateway {
  /**
   * ایجاد درخواست پرداخت
   * @returns URL پرداخت و کد پیگیری
   */
  createPayment(
    amount: number,
    userId: number,
    metadata?: any
  ): Promise<PaymentResult>;

  /**
   * تایید پرداخت
   * @returns نتیجه verify
   */
  verifyPayment(
    trackingCode: string,
    data?: any
  ): Promise<VerificationResult>;

  /**
   * بررسی وضعیت پرداخت
   */
  getPaymentStatus(
    trackingCode: string
  ): Promise<'pending' | 'completed' | 'failed'>;
}

interface PaymentResult {
  paymentUrl: string;
  trackingCode: string;
}

interface VerificationResult {
  success: boolean;
  amount: number;
  transactionId: string;
}
```

---

## استفاده در Bot

### نمایش روش‌های پرداخت

```typescript
import { PaymentFactory } from './infrastructure/payments/PaymentFactory';

// دریافت روش‌های موجود
const methods = PaymentFactory.getAvailableMethods();
// ['zarinpal', 'aqayepardakht', 'cardtocard', 'nowpayments']

// ایجاد کیبورد
const keyboard = methods.map(method => [{
  text: getMethodName(method),
  callback_data: `pay:${method}:${amount}`
}]);
```

### پردازش پرداخت

```typescript
bot.callbackQuery(/pay:(\w+):(\d+)/, async (ctx) => {
  const method = ctx.match[1];
  const amount = parseInt(ctx.match[2]);
  
  try {
    const gateway = PaymentFactory.create(method);
    const result = await gateway.createPayment(amount, ctx.from.id);
    
    await ctx.reply(`لینک پرداخت: ${result.paymentUrl}`);
  } catch (error) {
    await ctx.reply('خطا در ایجاد پرداخت');
  }
});
```

---

## Database Schema

```prisma
model PaymentReport {
  id              Int           @id @default(autoincrement())
  userId          Int
  orderId         String        @unique
  amount          Decimal
  method          PaymentMethod
  status          PaymentStatus
  transactionId   String?
  photoId         String?       // رسید card-to-card
  description     String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  user            User          @relation(fields: [userId], references: [id])
}

enum PaymentMethod {
  ZARINPAL
  AQAYE_PARDAKHT
  CARD_TO_CARD
  NOWPAYMENTS
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}
```

---

## Flow کامل

### Zarinpal/AqayePardakht:
1. User انتخاب مبلغ → کلیک روش پرداخت
2. Bot ایجاد payment → دریافت URL
3. User کلیک روی لینک → redirect به درگاه
4. User پرداخت → redirect به callback
5. Bot verify → شارژ موجودی

### Card-to-Card:
1. User انتخاب کارت به کارت
2. Bot نمایش شماره کارت
3. User واریز → آپلود رسید
4. Admin بررسی → تایید/رد
5. Bot شارژ موجودی (در صورت تایید)

### NowPayments:
1. User انتخاب crypto → انتخاب ارز
2. Bot ایجاد invoice → دریافت URL
3. User پرداخت crypto
4. IPN webhook → bot
5. Bot verify → شارژ موجودی

---

## مقایسه درگاه‌ها

| ویژگی | Zarinpal | AqayePardakht | Card-to-Card | NowPayments |
|-------|----------|---------------|--------------|-------------|
| **نوع** | بانکی | بانکی | دستی | کریپتو |
| **خودکار** | ✅ | ✅ | ❌ | ✅ |
| **کارمزد** | 1-2% | 1-2% | 0% | 0.5% |
| **سرعت** | آنی | آنی | 1-24 ساعت | 10-60 دقیقه |
| **Sandbox** | ✅ | ❌ | - | ✅ |
| **Callback** | ✅ | ✅ | - | ✅ (IPN) |

---

## تست

### Zarinpal Sandbox

```bash
# Development mode
NODE_ENV=development npm run dev

# کارت تست: 6104-3377-6037-1234
# CVV2: هر عددی
# تاریخ: آینده
```

### AqayePardakht

- نیاز به PIN واقعی دارد
- Sandbox ندارد
- پیشنهاد: از مبلغ کم تست کنید

### Card-to-Card

- هیچ محیط تستی ندارد
- مستقیماً قابل استفاده
- پیشنهاد: با کاربر تست انجام دهید

### NowPayments

```bash
# Sandbox API
NOWPAYMENTS_API_KEY=sandbox-key
```

---

## Error Handling

```typescript
import { PaymentError } from './core/errors';

try {
  const result = await gateway.createPayment(amount, userId);
} catch (error) {
  if (error instanceof PaymentError) {
    logger.error('Payment error:', error.message);
    
    // نمایش خطا به کاربر
    await ctx.reply(`خطا: ${error.message}`);
  }
}
```

---

## BullMQ Integration

برای card-to-card، worker خودکاری برای verify وجود دارد:

```typescript
// CardPaymentVerifyWorker.ts
export class CardPaymentVerifyWorker {
  async process() {
    // بررسی پرداخت‌های pending
    const pending = await prisma.paymentReport.findMany({
      where: {
        method: 'CARD_TO_CARD',
        status: 'PENDING',
      }
    });

    // ارسال notification به admin
    for (const payment of pending) {
      await notifyAdmin(payment);
    }
  }
}
```

---

## Admin Panel

### تایید Card-to-Card

```typescript
bot.callbackQuery(/approve_payment:(\d+)/, async (ctx) => {
  const paymentId = parseInt(ctx.match[1]);
  
  const gateway = PaymentFactory.create('cardtocard');
  await gateway.verifyPayment(paymentId.toString(), {
    adminApproved: true,
  });
  
  await ctx.reply('✅ پرداخت تایید شد');
});
```

---

## آمار درگاه‌ها

| درگاه | خطوط کد | Auth Type | Auto Verify | وضعیت |
|-------|---------|-----------|-------------|-------|
| Zarinpal | 125 | Merchant ID | ✅ | ✅ |
| AqayePardakht | 190 | PIN | ✅ | ✅ |
| CardToCard | 85 | - | ❌ | ✅ |
| NowPayments | 170 | API Key | ✅ | ✅ |

---

## Roadmap

- [x] Zarinpal Gateway
- [x] AqayePardakht Gateway  
- [x] Card-to-Card Gateway
- [x] NowPayments Gateway
- [ ] ZarinPal Wage (کارمزد اشتراکی)
- [ ] Perfect Money
- [ ] Payeer
- [ ] Auto-refund برای پرداخت‌های ناموفق
- [ ] Payment analytics dashboard

---

**آخرین به‌روزرسانی:** 2026-02-11  
**نسخه:** 1.0.0

