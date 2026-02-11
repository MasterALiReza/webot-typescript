# راهنمای راه‌اندازی و استفاده کامل

این سند راهنمای گام‌به‌گام نصب، پیکربندی و استفاده از WeBot است.

---

## 📋 پیش‌نیازها

قبل از شروع، مطمئن شوید که موارد زیر را نصب کرده‌اید:

### نرم‌افزارهای ضروری
- **Node.js** >= 20.x ([دانلود](https://nodejs.org/))
- **MySQL** >= 8.0 ([دانلود](https://dev.mysql.com/downloads/))
- **Redis** >= 6.0 ([دانلود](https://redis.io/download/))
- **npm** یا **yarn**

### دسترسی‌های مورد نیاز
- یک ربات تلگرام (از [@BotFather](https://t.me/BotFather))
- حداقل یک پنل VPN فعال
- (اختیاری) حساب کاربری در یکی از درگاه‌های پرداخت

---

## 🚀 مرحله 1: نصب پروژه

### Clone کردن Repository

```bash
git clone https://github.com/yourusername/WeBot.git
cd WeBot
```

### نصب Dependencies

```bash
npm install
```

این دستور تمام پکیج‌های مورد نیاز را نصب می‌کند شامل:
- Grammy (Telegram Bot Framework)
- Prisma (ORM)
- BullMQ (Job Queue)
- Axios (HTTP Client)
- و...

---

## 🔧 مرحله 2: تنظیم Environment Variables

### کپی کردن فایل نمونه

```bash
cp .env.example .env
```

### ویرایش `.env`

فایل `.env` را با یک ویرایشگر متن باز کنید و مقادیر زیر را وارد کنید:

```env
# ============= Bot Configuration =============
# توکن ربات تلگرام (از @BotFather دریافت کنید)
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# شناسه عددی ادمین‌ها (Chat ID - با کاما جدا کنید)
ADMIN_CHAT_ID=123456789,987654321

# محیط اجرا (development یا production)
NODE_ENV=development

# ============= Database =============
DATABASE_URL="mysql://root:password@localhost:3306/WeBot"

# ============= Redis =============
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ============= Payment Gateways (Optional) =============
# Zarinpal
ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ZARINPAL_CALLBACK_URL=https://yourdomain.com/api/zarinpal/callback

# AqayePardakht
AQAYEPARDAKHT_PIN=your-pin-code-here
AQAYEPARDAKHT_CALLBACK_URL=https://yourdomain.com/api/aqayepardakht/callback

# Card-to-Card
CARD_TO_CARD_NUMBER=6037-9977-1234-5678
CARD_TO_CARD_HOLDER=علی احمدی
CARD_TO_CARD_BANK=ملی

# NowPayments (Crypto)
NOWPAYMENTS_API_KEY=your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=your-ipn-secret
NOWPAYMENTS_IPN_URL=https://yourdomain.com/api/nowpayments/ipn

# ============= Optional Settings =============
# Rate Limiting
MESSAGE_LIMIT_PER_MIN=10

# Expiry cleanup
REMOVE_DAYS_AFTER_EXPIRY=7

# Logging
LOG_LEVEL=info
```

### دریافت Chat ID

برای دریافت Chat ID خود:
1. به ربات [@userinfobot](https://t.me/userinfobot) پیام `/start` بدهید
2. عدد مقابل "Id" را کپی کنید
3. در `ADMIN_CHAT_ID` قرار دهید

---

## 💾 مرحله 3: راه‌اندازی Database

### ایجاد دیتابیس MySQL

```bash
# ورود به MySQL
mysql -u root -p

# ایجاد دیتابیس
CREATE DATABASE WeBot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# ایجاد کاربر (اختیاری)
CREATE USER 'WeBot'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON WeBot.* TO 'WeBot'@'localhost';
FLUSH PRIVILEGES;

# خروج
EXIT;
```

### اجرای Migrations

```bash
# Generate Prisma Client
npx prisma generate

# اجرای migrations
npx prisma migrate deploy

# (اختیاری) Prisma Studio برای مدیریت دیتا
npx prisma studio
```

---

## 🗃️ مرحله 4: راه‌اندازی Redis

### نصب Redis (اگر نصب نیست)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Windows:**
- از [Redis for Windows](https://github.com/microsoftarchive/redis/releases) دانلود کنید
- یا از WSL استفاده کنید

**macOS:**
```bash
brew install redis
brew services start redis
```

### تست اتصال Redis

```bash
redis-cli ping
# باید "PONG" برگردد
```

---

## 🎯 مرحله 5: افزودن داده‌های اولیه

### الف) افزودن پنل VPN

شما می‌توانید پنل را از 2 روش اضافه کنید:

#### روش 1: از طریق Admin Panel (پیشنهادی)

1. ربات را اجرا کنید (مرحله 6)
2. دستور `/admin` را بفرستید
3. "🖥 مدیریت پنل‌ها" → "➕ افزودن پنل"
4. اطلاعات را وارد کنید

#### روش 2: مستقیم از Database

```sql
INSERT INTO Panel (name, type, url, username, password, status)
VALUES 
  ('Marzban Panel 1', 'MARZBAN', 'https://panel.example.com', 'admin', 'secure_pass', 'ACTIVE'),
  ('X-UI Panel', 'X_UI', 'http://1.2.3.4:54321', 'admin', 'admin123', 'ACTIVE');
```

**انواع پنل‌های پشتیبانی شده:**
- `MARZBAN`
- `MARZNESHIN`
- `X_UI`
- `S_UI`
- `ALIREZA`
- `WGDASHBOARD`
- `MIKROTIK`

### ب) افزودن محصولات

```sql
INSERT INTO Product (name, description, price, volume, duration, panelId, isActive)
VALUES 
  ('پلن ماهانه 50GB', 'سرویس یک ماهه با 50 گیگابایت', 50000, 50, 30, 1, true),
  ('پلن ماهانه 100GB', 'سرویس یک ماهه با 100 گیگابایت', 90000, 100, 30, 1, true),
  ('پلن 3 ماهه 200GB', 'سرویس سه ماهه با 200 گیگابایت', 250000, 200, 90, 1, true);
```

---

## ▶️ مرحله 6: اجرای ربات

### Development Mode (با Hot Reload)

```bash
npm run dev
```

### Production Mode

```bash
# Build TypeScript
npm run build

# اجرا
npm start
```

### استفاده از PM2 (پیشنهادی برای Production)

```bash
# نصب PM2
npm install -g pm2

# شروع ربات
pm2 start npm --name "WeBot" -- start

# مشاهده logs
pm2 logs WeBot

# Restart
pm2 restart WeBot

# Stop
pm2 stop WeBot
```

### استفاده از Docker

```bash
# Build و اجرا
docker-compose up -d

# مشاهده logs
docker-compose logs -f app

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```

---

## � مرحله 7: استفاده از ربات

### دستورات کاربر

- `/start` - شروع ربات و دریافت منوی اصلی
- `🛒 خرید سرویس` - مشاهده و خرید محصولات
- `📦 سرویس‌های من` - مشاهده سرویس‌های فعال
- `💰 کیف پول` - مدیریت موجودی، شارژ، لینک دعوت
- `❓ راهنما` - راهنمای استفاده
- `👤 پروفایل` - اطلاعات کاربری

### دستورات ادمین

- `/admin` - ورود به پنل مدیریت

**قابلیت‌های پنل ادمین:**
- 📊 **آمار** - کاربران، فروش، سرویس‌ها، درآمد
- 👥 **مدیریت کاربران** - جستجو، مشاهده، مسدود/رفع مسدودیت، شارژ
- � **مدیریت پنل‌ها** - افزودن، ویرایش، تست، حذف
- � **مدیریت محصولات** - ایجاد، ویرایش، فعال/غیرفعال
- 📢 **Broadcast** - ارسال پیام گروهی
- 💳 **تنظیمات پرداخت** - مشاهده تنظیمات درگاه‌ها
- ⚙️ **تنظیمات** - پیکربندی عمومی

---

## 🔧 تنظیمات پیشرفته

### تنظیم Rate Limiting

```env
# حداکثر پیام در دقیقه
MESSAGE_LIMIT_PER_MIN=10

# زمان timeout (میلی‌ثانیه)
RATE_LIMIT_WINDOW_MS=60000
```

### تنظیم Scheduled Jobs

```env
# فواصل زمانی cron jobs
EXPIRY_CHECK_CRON=0 9 * * *        # هر روز ساعت 9 صبح
VOLUME_CHECK_CRON=0 */6 * * *      # هر 6 ساعت
CLEANUP_CRON=0 2 * * *             # هر روز ساعت 2 بامداد
```

### چند ادمین

برای افزودن چند ادمین، Chat ID‌ها را با کاما جدا کنید:

```env
ADMIN_CHAT_ID=123456789,987654321,555666777
```

### تنظیم Logging

```env
# سطح log: error, warn, info, debug
LOG_LEVEL=info

# مسیر فایل‌های log
LOG_DIR=./logs
```

---

## 📝 Logs و Debugging

### مشاهده Logs

Logs در پوشه `logs/` ذخیره می‌شوند:

```
logs/
├── error.log      # فقط خطاها
├── combined.log   # همه logs
└── app.log        # application logs
```

**مشاهده لحظه‌ای logs:**

```bash
# Windows PowerShell
Get-Content -Path logs/combined.log -Wait -Tail 50

# Unix/Linux/Mac
tail -f logs/combined.log

# با PM2
pm2 logs WeBot --lines 100
```

### Debug Mode

برای دیدن logs بیشتر:

```env
NODE_ENV=development
LOG_LEVEL=debug
```

---

## ❓ عیب‌یابی مشکلات رایج

### 1. Prisma Client not generated

**خطا:**
```
Cannot find module '@prisma/client'
```

**راه‌حل:**
```bash
npx prisma generate
```

### 2. Database Connection Error

**خطا:**
```
Can't reach database server at localhost:3306
```

**راه‌حل:**
- بررسی کنید MySQL روشن است: `sudo systemctl status mysql`
- `DATABASE_URL` را بررسی کنید
- دسترسی‌های database را تست کنید

### 3. Redis Connection Failed

**خطا:**
```
Error connecting to Redis
```

**راه‌حل:**
```bash
# بررسی وضعیت Redis
redis-cli ping

# اگر خاموش است
sudo systemctl start redis

# یا
brew services start redis  # macOS
```

### 4. Bot Token Invalid

**خطا:**
```
401 Unauthorized
```

**راه‌حل:**
- توکن را از @BotFather دوباره دریافت کنید
- مطمئن شوید فاصله اضافی وجود ندارد
- توکن را مستقیماً کپی-پیست کنید

### 5. پنل متصل نمی‌شود

**راه‌حل:**
1. URL پنل را با مرورگر تست کنید
2. Username/Password را چک کنید
3. از دکمه "تست اتصال" در admin panel استفاده کنید
4. Firewall را بررسی کنید

### 6. Payment Gateway Error

**راه‌حل:**
- کلیدهای API را چک کنید
- Callback URLs را verify کنید
- در development mode از Sandbox استفاده کنید

---

##  🔐 امنیت

### بهترین شیوه‌ها

✅ **انجام دهید:**
- از password های قوی استفاده کنید
- `.env` را NEVER commit نکنید
- در production از HTTPS استفاده کنید
- SSL certificates را به‌روز نگه دارید
- Rate limiting را فعال کنید
- Logs را منظم بررسی کنید

❌ **انجام ندهید:**
- Credentials را hardcode نکنید
- Admin credentials را share نکنید
- Debug logs را در production نگذارید
- Database را بدون backup نگه ندارید

### فایل `.gitignore`

مطمئن شوید این موارد در `.gitignore` هستند:

```gitignore
.env
.env.local
node_modules/
dist/
logs/
*.log
.DS_Store
```

---

## 🧪 تست

### تست Manual

1. `/start` → چک کردن welcome message
2. خرید سرویس → تست کامل flow
3. شارژ کیف پول → تست payment
4. `/admin` → تست admin features
5. مشاهده سرویس‌ها → چک service list

### تست Panel Connection

از Admin Panel:
1. `/admin` → "🖥 مدیریت پنل‌ها"
2. انتخاب پنل
3. "🔍 تست اتصال"

### تست Payment Gateway

**Zarinpal Sandbox:**
- کارت تست: `5022-2910-7000-0000`
- CVV2: هر عددی
- تاریخ: آینده

---

## 📊 Monitoring

### BullMQ Dashboard (اختیاری)

```bash
# نصب Bull Board
npm install @bull-board/express

# دسترسی از: http://localhost:3000/admin/queues
```

### Health Check

```typescript
// ایجاد endpoint برای health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    database: 'connected',
    redis: 'connected'
  });
});
```

---

## 🔄 Backup و Recovery

### Backup Database

```bash
# Backup
mysqldump -u root -p WeBot > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p WeBot < backup_20260211.sql
```

### Backup Redis

```bash
# Redis snapshots ذخیره می‌شوند در
/var/lib/redis/dump.rdb

# یا manual save
redis-cli SAVE
```

---

## 🚀 Deployment

### Production Checklist

- [ ] `NODE_ENV=production` در `.env`
- [ ] SSL certificates نصب شدند
- [ ] Firewall پیکربندی شد
- [ ] Database backup تنظیم شد
- [ ] Monitoring فعال شد
- [ ] Rate limiting فعال است
- [ ] Logs rotation تنظیم شد
- [ ] PM2 یا Docker برای uptime
- [ ] Domain و DNS تنظیم شد

### مراحل Deployment

1. Build production:
   ```bash
   npm run build
   ```

2. تنظیم environment:
   ```bash
   NODE_ENV=production
   ```

3. Start با PM2:
   ```bash
   pm2 start npm --name WeBot -- start
   pm2 save
   pm2 startup
   ```

4. تنظیم Nginx (اختیاری):
   ```nginx
   server {
     listen 80;
     server_name yourdomain.com;
     
     location / {
       proxy_pass http://localhost:3000;
     }
   }
   ```

---

## 🆘 پشتیبانی

در صورت بروز مشکل:

1. **Logs را بررسی کنید**: `logs/error.log`
2. **دیتابیس را چک کنید**: `npx prisma studio`
3. **Build بگیرید**: `npm run build`
4. **Clean install**: 
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
5. **Restart کنید**: `pm2 restart WeBot`

---

## 📚 منابع بیشتر

- [راهنمای Panel Adapters](./PANEL_ADAPTERS_GUIDE.md)
- [راهنمای Payment Gateways](./PAYMENT_GATEWAYS_GUIDE.md)  
- [راهنمای Migration از PHP](./migration-guide.md)
- [مثال‌های کد](./examples.md)

---

✅ **آماده استفاده!** ربات شما اکنون باید بدون مشکل کار کند.

آخرین به‌روزرسانی: 2026-02-11

