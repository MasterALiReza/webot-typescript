# WeBot VPN Bot 🚀

<div align="center">

![WeBot Logo](https://img.shields.io/badge/WeBot-VPN%20Bot-blue?style=for-the-badge)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**سیستم فروش خودکار VPN با معماری Clean Architecture**

[English](#english) | [فارسی](#فارسی)

</div>

---

## فارسی

### 📖 درباره پروژه

**WeBot** یک ربات تلگرام مدرن برای فروش خودکار سرویس‌های VPN است که با TypeScript و Clean Architecture طراحی شده است. این ربات از **7 نوع پنل VPN** و **4 درگاه پرداخت** مختلف پشتیبانی می‌کند.

### ✨ ویژگی‌های کلیدی

#### 🏗️ معماری و زیرساخت
- ✅ **Clean Architecture** - جداسازی کامل لایه‌ها
- ✅ **TypeScript** - Type Safety کامل
- ✅ **Prisma ORM** - مدیریت دیتابیس پیشرفته
- ✅ **BullMQ** - سیستم Job Queue
- ✅ **Redis** - Cache و Queue Management
- ✅ **Docker Support** - Deploy آسان

#### 🔌 پنل‌های پشتیبانی شده (7 نوع)

| پنل | وضعیت | ویژگی‌ها |
|-----|------|----------|
| **Marzban** | ✅ | Token auth, User management, Stats |
| **Marzneshin** | ✅ | Advanced expiry strategies |
| **X-UI / 3x-ui** | ✅ | Cookie auth, Inbound management |
| **S-UI** | ✅ | Full CRUD, Stats |
| **Alireza (X-UI)** | ✅ | X-UI variant, API v2 |
| **WireGuard Dashboard** | ✅ | API key auth, Peer management |
| **MikroTik RouterOS** | ✅ | REST API, User-Manager |

#### 💳 درگاه‌های پرداخت (4 نوع)

| درگاه | نوع | وضعیت |
|-------|-----|------|
| **Zarinpal** | آنلاین | ✅ + Sandbox |
| **AqayePardakht** | آنلاین | ✅ API v2 |
| **Card-to-Card** | دستی | ✅ + Receipt Upload |
| **NowPayments** | کریپتو | ✅ 150+ Coins |

#### 👤 امکانات کاربری
- ✅ سیستم افیلیت و زیرمجموعه‌گیری
- ✅ کیف پول دیجیتال
- ✅ شارژ آنلاین
- ✅ مدیریت سرویس‌ها
- ✅ تمدید و خرید حجم
- ✅ QR Code و لینک اتصال

#### 👨‍💼 پنل مدیریت
- ✅ آمار و گزارش‌گیری کامل
- ✅ مدیریت کاربران
- ✅ مدیریت پنل‌ها
- ✅ مدیریت محصولات
- ✅ Broadcast پیام‌ها
- ✅ تنظیمات پرداخت

#### ⚡ Automation Jobs (BullMQ)
- ✅ **Expiry Warning** - هشدار 7، 3، 1 روز قبل
- ✅ **Volume Warning** - هشدار 80% و 90%
- ✅ **Auto Verify** - تایید خودکار پرداخت
- ✅ **Cleanup** - پاکسازی خودکار
- ✅ **Broadcast** - ارسال گروهی

### 🚀 نصب سریع

#### با اسکریپت خودکار (Linux)
```bash
bash <(curl -Ls https://raw.githubusercontent.com/MasterALiReza/webot-typescript/main/install.sh)
```

#### نصب دستی
```bash
# Clone repository
git clone https://github.com/MasterALiReza/webot-typescript.git
cd webot-typescript

# نصب dependencies
npm install

# تنظیم environment
cp .env.example .env
nano .env  # ویرایش تنظیمات

# راه‌اندازی دیتابیس
npx prisma generate
npx prisma migrate deploy

# اجرا
npm run build
npm start
```

#### با Docker
```bash
docker-compose up -d
```

### 📋 پیش‌نیازها

- Node.js >= 20.x
- MySQL >= 8.0
- Redis >= 6.0
- یک پنل VPN فعال
- توکن ربات تلگرام از [@BotFather](https://t.me/BotFather)

### 🔧 تنظیمات

فایل `.env` را ویرایش کنید:

```env
# Bot
BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_chat_id

# Database
DATABASE_URL="mysql://user:pass@localhost:3306/webot"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Payment Gateways (optional)
ZARINPAL_MERCHANT_ID=
AQAYEPARDAKHT_PIN=
NOWPAYMENTS_API_KEY=
```

### 📁 ساختار پروژه

```
src/
├── core/              # Domain Layer
│   ├── interfaces/    # Interface definitions
│   └── errors/        # Custom errors
├── application/       # Use Cases
├── infrastructure/    # External Services
│   ├── database/      # Prisma + Repositories
│   ├── panels/        # 7 Panel Adapters
│   ├── payments/      # 4 Payment Gateways
│   └── queue/         # BullMQ Workers
├── presentation/      # Bot Layer
│   ├── handlers/      # Commands & Callbacks
│   ├── keyboards/     # Telegram keyboards
│   └── middlewares/   # Bot middlewares
├── locales/          # i18n (fa.json)
└── shared/           # Config, Logger, Utils
```

### 📊 آمار پروژه

- **35+ فایل** TypeScript
- **~8,000 خط** کد
- **7 Panel Adapter** کامل
- **4 Payment Gateway**
- **11 Admin Handler**
- **6 BullMQ Worker**
- **15 Database Model**

### 🤝 مشارکت

مشارکت‌ها خوشایند است! لطفاً:

1. Fork کنید
2. Feature branch بسازید (`git checkout -b feature/amazing`)
3. Commit کنید (`git commit -m 'Add feature'`)
4. Push کنید (`git push origin feature/amazing`)
5. Pull Request باز کنید

### 📝 لایسنس

این پروژه تحت [MIT License](LICENSE) منتشر شده است.

### 📞 پشتیبانی

- **Issues**: [GitHub Issues](https://github.com/MasterALiReza/webot-typescript/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MasterALiReza/webot-typescript/discussions)

---

## English

### 📖 About

**WeBot** is a modern Telegram bot for automated VPN service sales, built with TypeScript and Clean Architecture. Supports **7 VPN panels** and **4 payment gateways**.

### ✨ Key Features

- 🏗️ **Clean Architecture** - Complete layer separation
- 💎 **TypeScript** - Full type safety
- 🗄️ **Prisma ORM** - Advanced database management
- ⚡ **BullMQ** - Job queue system
- 🔄 **Redis** - Caching & queue management
- 🐳 **Docker** - Easy deployment

#### Supported Panels (7)
Marzban • Marzneshin • X-UI • S-UI • Alireza • WireGuard Dashboard • MikroTik

#### Payment Gateways (4)
Zarinpal • AqayePardakht • Card-to-Card • NowPayments (Crypto)

### 🚀 Quick Start

```bash
# Clone
git clone https://github.com/MasterALiReza/webot-typescript.git
cd webot-typescript

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your settings

# Run
npm run build
npm start
```

### 📖 Documentation

For detailed documentation, installation guides, and configuration:
- See inline code comments
- Check example `.env.example` file
- Review panel adapter implementations in `src/infrastructure/panels/`

### 🛠️ Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Database**: MySQL 8.0 + Prisma ORM
- **Cache**: Redis 6.0+
- **Queue**: BullMQ
- **Bot Framework**: Grammy
- **Container**: Docker

### 📊 Project Stats

- **35+** TypeScript files
- **~8,000** lines of production code
- **7** Panel adapters
- **4** Payment gateways
- **11** Admin handlers
- **6** Background workers

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for the Iranian VPN community**

[![GitHub stars](https://img.shields.io/github/stars/MasterALiReza/webot-typescript?style=social)](https://github.com/MasterALiReza/webot-typescript/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/MasterALiReza/webot-typescript?style=social)](https://github.com/MasterALiReza/webot-typescript/network/members)

</div>
