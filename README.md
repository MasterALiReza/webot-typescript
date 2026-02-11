# WeBot TypeScript - Modern VPN Service Sales Bot 🚀

سیستم فروش خودکار سرویس VPN با معماری Clean Architecture، پشتیبانی از 7 نوع پنل و 4 درگاه پرداخت.

---

## 🌟 ویژگی‌های کلیدی

- ✅ **7 Panel Adapter** (Marzban, Marzneshin, X-UI, S-UI, Alireza, WGDashboard, MikroTik)
- ✅ **4 Payment Gateway** (Zarinpal, AqayePardakht, Card-to-Card, NowPayments)
- ✅ **Clean Architecture** TypeScript
- ✅ **BullMQ Jobs** (Expiry/Volume warnings, Cleanup, Broadcast)
- ✅ **Admin Panel** (11 handlers)
- ✅ **i18n** (Persian/Farsi localization)

---

## 📚 مستندات

همه مستندات در پوشه [`docs/`](./docs/) قرار دارند:

- **[راهنمای نصب](./docs/SETUP_GUIDE.md)** - نصب گام‌به‌گام
- **[راهنمای Panel Adapters](./docs/PANEL_ADAPTERS_GUIDE.md)** - پیکربندی 7 پنل
- **[راهنمای Payment Gateways](./docs/PAYMENT_GATEWAYS_GUIDE.md)** - تنظیم 4 درگاه پرداخت
- **[راهنمای Migration](./docs/migration-guide.md)** - انتقال از PHP
- **[نمونه‌های کد](./docs/examples.md)** - مثال‌های استفاده

---

## ⚡ نصب سریع (Linux)

```bash
# دانلود و اجرای اسکریپت نصب
bash <(curl -Ls https://raw.githubusercontent.com/yourusername/webot-typescript/main/install.sh)
```

یا:

```bash
# کلون و نصب دستی
git clone https://github.com/yourusername/webot-typescript.git
cd webot-typescript
npm install
cp .env.example .env
# ویرایش .env
npm run build
npm start
```

---

## 🔧 پیش‌نیازها

- Node.js >= 20.x
- MySQL >= 8.0  
- Redis >= 6.0
- یک پنل VPN فعال
- توکن ربات تلگرام

برای جزئیات بیشتر به [راهنمای نصب](./docs/SETUP_GUIDE.md) مراجعه کنید.

---

## 📊 آمار پروژه

- **35+ فایل** TypeScript
- **~8,000 خط** کد production
- **7 Panel Adapter** کامل
- **4 Payment Gateway**
- **11 Admin Handler**
- **6 BullMQ Worker**
- **15 Database Model**

---

## 🤝 مشارکت

این پروژه open-source است و مشارکت‌ها استقبال می‌شود!

1. Fork کنید
2. Feature branch بسازید
3. Commit کنید
4. Pull Request باز کنید

---

## 📞 پشتیبانی

- **GitHub Issues**: [Report Issues](https://github.com/yourusername/webot-typescript/issues)
- **مستندات**: [docs/](./docs/)

---

## 📝 لایسنس

MIT License - برای استفاده آزاد

---

**ساخته شده با ❤️ برای جامعه VPN ایران**
