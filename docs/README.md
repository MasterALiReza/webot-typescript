# WeBot - Modern VPN Service Sales Bot 🚀

سیستم فروش خودکار سرویس VPN با معماری Clean Architecture، TypeScript و پشتیبانی کامل از 7 نوع پنل و 4 درگاه پرداخت.

## ✨ ویژگی‌های کلیدی

### 🏗️ معماری و زیرساخت
- ✅ **Clean Architecture** - جداسازی کامل لایه‌ها
- ✅ **TypeScript** - Type Safety کامل
- ✅ **Prisma ORM** - مدیریت دیتابیس پیشرفته
- ✅ **BullMQ** - سیستم Job Queue برای کارهای زمان‌بند
- ✅ **Redis** - Cache و Queue Management

### 🔌 پنل‌های پشتیبانی شده (7 نوع)
- ✅ **Marzban** - با token caching
- ✅ **Marzneshin** - با استراتژی‌های expiry پیشرفته
- ✅ **3x-ui / X-UI** - با cookie authentication
- ✅ **S-UI** - سیستم کامل CRUD
- ✅ **Alireza** - variant از x-ui با API اصلی
- ✅ **WireGuard Dashboard** - با API key auth و key generation
- ✅ **MikroTik RouterOS** - با REST API

### 💳 درگاه‌های پرداخت (4 نوع)
- ✅ **Zarinpal** - با حالت sandbox
- ✅ **AqayePardakht** - درگاه ایرانی با API v2
- ✅ **Card-to-Card** - با آپلود رسید و تایید دستی
- ✅ **NowPayments** - پرداخت با ارزهای دیجیتال

### 👤 امکانات کاربری
- ✅ سیستم افیلیت و زیرمجموعه‌گیری
- ✅ کیف پول دیجیتال
- ✅ شارژ آنلاین کیف پول
- ✅ مشاهده سرویس‌های فعال
- ✅ تمدید و خرید حجم اضافی
- ✅ دریافت QR Code و لینک اتصال

### 👨‍💼 پنل مدیریت کامل
- ✅ **آمار و گزارش‌گیری** - آمار کاربران، فروش، سرویس‌ها
- ✅ **مدیریت کاربران** - جستجو، مشاهده، مسدودسازی
- ✅ **مدیریت پنل‌ها** - افزودن، ویرایش، تست اتصال
- ✅ **مدیریت محصولات** - ایجاد، ویرایش، فعال/غیرفعال
- ✅ **سیستم Broadcast** - ارسال پیام گروهی
- ✅ **تنظیمات پرداخت** - مدیریت درگاه‌ها

### ⚡ سیستم Job Automation
- ✅ **هشدار انقضا** - 1، 3، 7 روز قبل از اتمام
- ✅ **هشدار حجم** - 80% و 90% مصرف
- ✅ **تایید خودکار** - پرداخت‌های کارت‌به‌کارت
- ✅ **پاکسازی خودکار** - سرویس‌های منقضی شده
- ✅ **پاکسازی تست** - اکانت‌های آزمایشی
- ✅ **ارسال گروهی** - پیام‌های Broadcast

### 🛡️ امنیت و کنترل
- ✅ **Rate Limiting** - محافظت در برابر spam
- ✅ **User Block Check** - کنترل کاربران مسدود
- ✅ **Admin Authentication** - احراز هویت ادمین
- ✅ **Error Handling** - مدیریت خطای پیشرفته

---

## 📋 پیش‌نیازها

- **Node.js** >= 20.x
- **MySQL** >= 8.0
- **Redis** >= 6.0
- حداقل یک پنل VPN فعال
- توکن ربات تلگرام از [@BotFather](https://t.me/BotFather)

---

## 🚀 نصب و راه‌اندازی

### 1. Clone و نصب پکیج‌ها

```bash
# Clone repository
git clone https://github.com/yourusername/WeBot.git
cd WeBot

# نصب dependencies
npm install
```

### 2. تنظیم Environment Variables

```bash
# کپی کردن فایل نمونه
cp .env.example .env

# ویرایش فایل .env
nano .env
```

**متغیرهای ضروری:**

```env
# Bot Configuration
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=123456789,987654321

# Database
DATABASE_URL="mysql://user:pass@localhost:3306/WeBot"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Payment Gateways (optional)
ZARINPAL_MERCHANT_ID=
AQAYEPARDAKHT_PIN=
NOWPAYMENTS_API_KEY=
```

### 3. راه‌اندازی دیتابیس

```bash
# Generate Prisma Client
npx prisma generate

# اجرای migrations
npx prisma migrate deploy

# (اختیاری) مشاهده دیتا با Prisma Studio
npx prisma studio
```

### 4. اجرای ربات

```bash
# Development Mode
npm run dev

# Production Build
npm run build
npm start

# با Docker Compose
docker-compose up -d
```

---

## 📁 ساختار پروژه

```
src/
├── core/                    # Domain Layer
│   ├── interfaces/         # Interface definitions
│   └── errors/            # Custom error classes
│
├── application/            # Use Cases
│   └── usecases/          # Business logic
│
├── infrastructure/         # External Services
│   ├── database/          # Prisma + Repositories
│   ├── panels/            # Panel Adapters (7 types)
│   ├── payments/          # Payment Gateways (4 types)
│   └── queue/             # BullMQ Jobs (6 workers)
│
├── presentation/           # Bot Layer
│   ├── handlers/          # Command & Callback handlers
│   ├── keyboards/         # Telegram keyboards
│   ├── middlewares/       # Bot middlewares
│   └── admin/            # Admin panel handlers (11)
│
├── locales/               # i18n translations
│   └── fa.json           # Persian texts
│
├── shared/                # Shared utilities
│   ├── config.ts         # Configuration
│   ├── logger.ts         # Winston logger
│   └── i18n.ts           # Localization
│
└── index.ts              # Main entry point
```

---

## 🎮 دستورات

```bash
# Development
npm run dev              # اجرا با nodemon (hot reload)

# Production
npm run build           # Build TypeScript
npm start              # اجرای production

# Database
npx prisma generate    # Generate client
npx prisma migrate dev # ایجاد migration
npx prisma studio      # دیتابیس UI

# Utilities
npm run lint           # ESLint check
npm run format         # Prettier format
```

---

## 📖 مستندات

- **[راهنمای نصب کامل](./SETUP_GUIDE.md)** - مراحل دقیق نصب
- **[راهنمای Panel Adapters](./PANEL_ADAPTERS_GUIDE.md)** - تنظیم پنل‌ها
- **[راهنمای Payment Gateways](./PAYMENT_GATEWAYS_GUIDE.md)** - تنظیم درگاه‌ها
- **[راهنمای Migration](./migration-guide.md)** - انتقال از PHP
- **[مثال‌ها](./examples.md)** - نمونه‌های کد

---

## 🔧 تنظیمات اولیه

### افزودن اولین پنل

پس از راه‌اندازی ربات:

1. دستور `/admin` را به ربات ارسال کنید
2. "🖥 مدیریت پنل‌ها" را انتخاب کنید  
3. "➕ افزودن پنل" را بزنید
4. اطلاعات پنل را وارد کنید:
   - نوع پنل (Marzban, X-UI, ...)
   - URL پنل
   - Username و Password

### افزودن محصول

1. از پنل ادمین "📦 مدیریت محصولات" را انتخاب کنید
2. "➕ افزودن محصول" را بزنید
3. مشخصات محصول را وارد کنید:
   - نام محصول
   - قیمت (تومان)
   - حجم (GB)
   - مدت زمان (روز)
   - پنل مربوطه

---

## 🌐 پنل‌های پشتیبانی شده

| پنل | وضعیت | ویژگی‌ها |
|-----|------|----------|
| **Marzban** | ✅ کامل | Token auth, User management, Stats |
| **Marzneshin** | ✅ کامل | Advanced expiry, Traffic management |
| **X-UI / 3x-ui** | ✅ کامل | Cookie auth, Inbound management |
| **S-UI** | ✅ کامل | Full CRUD, Stats |
| **Alireza** | ✅ کامل | X-UI variant, API v2 |
| **WGDashboard** | ✅ کامل | WireGuard, Peer management, Jobs |
| **MikroTik** | ✅ کامل | RouterOS API, User-Manager |

---

## 💰 درگاه‌های پرداخت

| درگاه | نوع | وضعیت |
|-------|-----|------|
| **Zarinpal** | آنلاین | ✅ کامل + Sandbox |
| **AqayePardakht** | آنلاین | ✅ کامل API v2 |
| **Card-to-Card** | دستی | ✅ کامل + Receipt |
| **NowPayments** | کریپتو | ✅ کامل + Webhook |

---

## 🔄 BullMQ Jobs

| Job | Schedule | توضیحات |
|-----|----------|----------|
| **Expiry Warning** | روزانه | هشدار 7، 3، 1 روز قبل از انقضا |
| **Volume Warning** | هر 6 ساعت | هشدار 80% و 90% حجم |
| **Card Payment Verify** | هر 15 دقیقه | بررسی پرداخت‌های کارت‌به‌کارت |
| **Expired Cleanup** | روزانه | حذف سرویس‌های منقضی |
| **Test Cleanup** | روزانه | حذف اکانت‌های تست |
| **Broadcast** | On-demand | ارسال پیام‌های گروهی |

---

## 🐛 عیب‌یابی

### ربات استارت نمی‌شود

```bash
# بررسی لاگ‌ها
npm run dev

# بررسی اتصال دیتابیس
npx prisma db pull

# بررسی اتصال Redis
redis-cli ping
```

### خطای Prisma

```bash
# Regenerate client
npx prisma generate

# Reset database (⚠️ حذف همه دیتا)
npx prisma migrate reset
```

### پنل متصل نمی‌شود

1. آدرس URL را بررسی کنید
2. Username/Password را چک کنید
3. از دکمه "تست اتصال" در پنل ادمین استفاده کنید

---

## 📊 آمار پروژه

- **35+ فایل** TypeScript
- **~8,000+ خط** کد production
- **7 Panel Adapter** کامل
- **4 Payment Gateway** فعال
- **11 Admin Handler** پیاده‌سازی شده
- **6 BullMQ Worker** آماده
- **15 Database Model** با Prisma

---

## 🤝 مشارکت

مشارکت‌ها استقبال می‌شوند! لطفاً:

1. Fork کنید
2. Feature branch بسازید (`git checkout -b feature/amazing`)
3. Commit کنید (`git commit -m 'Add amazing feature'`)
4. Push کنید (`git push origin feature/amazing`)  
5. Pull Request باز کنید

---

## 📝 لایسنس

این پروژه تحت لایسنس MIT منتشر شده است. برای جزئیات بیشتر فایل [LICENSE](./LICENSE) را مطالعه کنید.

---

## 💬 پشتیبانی

- **Issues**: [GitHub Issues](https://github.com/yourusername/WeBot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/WeBot/discussions)

---

**ساخته شده با ❤️ برای جامعه VPN ایران**

