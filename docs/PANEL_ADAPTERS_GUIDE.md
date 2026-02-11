# راهنمای پنل‌های پشتیبانی شده

این سند راهنمای کامل پیکربندی و استفاده از 7 نوع پنل VPN پشتیبانی شده در WeBot است.

---

## فهرست مطالب

1. [Marzban](#1-marzban)
2. [Marzneshin](#2-marzneshin)
3. [X-UI / 3x-ui](#3-x-ui--3x-ui)
4. [S-UI Panel](#4-s-ui-panel)
5. [Alireza (X-UI Variant)](#5-alireza-x-ui-variant)
6. [WireGuard Dashboard](#6-wireguard-dashboard)
7. [MikroTik RouterOS](#7-mikrotik-routeros)

---

## 1. Marzban

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- Bearer token authentication با caching
- مدیریت کامل کاربران (CRUD)
- مدیریت حجم و زمان
- ریست ترافیک
- رفع اشتراک (revoke subscription)
- دریافت لینک subscription

### تنظیمات

```json
{
  "name": "My Marzban Panel",
  "type": "MARZBAN",
  "url": "https://panel.example.com",
  "username": "admin",
  "password": "admin_password",
  "status": "ACTIVE"
}
```

### مثال استفاده

```typescript
const adapter = await PanelFactory.createFromName('My Marzban Panel');

// ایجاد کاربر
const user = await adapter.createUser({
  username: 'user_123',
  volume: 50, // GB
  duration: 30, // days
});

console.log(user.subscriptionUrl); // لینک اتصال
```

---

## 2. Marzneshin

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- از همان API Marzban استفاده می‌کند
- استراتژی‌های expiry پیشرفته
- مدیریت ترافیک پیشرفته‌تر
- همان قابلیت‌های Marzban

### تنظیمات

```json
{
  "name": "My Marzneshin Panel",
  "type": "MARZNESHIN",
  "url": "https://panel.example.com",
  "username": "admin",
  "password": "admin_password",
  "status": "ACTIVE"
}
```

**نکته:** Marzneshin از همان `MarzbanAdapter` استفاده می‌کند چون API یکسانی دارند.

---

## 3. X-UI / 3x-ui

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- Session-based authentication (Cookie)
- ایجاد کاربر با UUID
- مدیریت inbounds
- ریست ترافیک
- غیرفعال‌سازی کاربر
- Update تنظیمات کاربر

### تنظیمات

```json
{
  "name": "My X-UI Panel",
  "type": "X_UI",
  "url": "http://panel.example.com:54321",
  "username": "admin",
  "password": "admin123",
  "inboundId": "1",
  "status": "ACTIVE"
}
```

### نکات مهم

- X-UI معمولاً روی پورت `54321` اجرا می‌شود
- `inboundId` شناسه inbound مورد نظر را مشخص می‌کند
- Authentication با Cookie انجام می‌شود

---

## 4. S-UI Panel

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- REST API کامل
- Bearer token authentication
- مدیریت کاربران
- آمارگیری ترافیک
- مدیریت subscription URL

### تنظیمات

```json
{
  "name": "My S-UI Panel",
  "type": "S_UI",
  "url": "http://panel.example.com:8080",
  "username": "admin",
  "password": "admin123",
  "inboundId": "1",
  "status": "ACTIVE"
}
```

---

## 5. Alireza (X-UI Variant)

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- نسخه سفارشی‌شده از X-UI
- Session-based authentication
- API v2 با قابلیت‌های اضافی
- مدیریت کاربران با subId
- پشتیبانی از limitIp

### تنظیمات

```json
{
  "name": "Alireza Panel",
  "type": "ALIREZA",
  "url": "http://panel.example.com",
  "username": "admin",
  "password": "admin123",
  "inboundId": "1",
  "status": "ACTIVE"
}
```

### تفاوت‌ها با X-UI

- API endpoints متفاوت (`/panel/api/inbounds/add`, `/panel/api/inbounds/list`)
- ساختار داده client متفاوت (با `subId` به جای `id`)
- مدیریت session بهتر

---

## 6. WireGuard Dashboard

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- API key authentication
- مدیریت Peers (کاربران)
- تولید خودکار کلیدهای WireGuard
- دانلود فایل config
- Job scheduling برای expiry و volume
- پشتیبانی از QR Code

### تنظیمات

```json
{
  "name": "WGDashboard",
  "type": "WGDASHBOARD",
  "url": "http://panel.example.com:10086",
  "password": "your-api-key",
  "inboundId": "wg0",
  "status": "ACTIVE"
}
```

### نکات مهم

- `password` در اینجا API key است
- `inboundId` نام interface WireGuard است (مثلاً `wg0`, `wg1`)
- پورت پیش‌فرض معمولاً `10086` است
- Config file به صورت خودکار تولید می‌شود

### مثال استفاده

```typescript
const adapter = await PanelFactory.createFromName('WGDashboard');

// ایجاد peer
const user = await adapter.createUser({
  username: 'peer_123',
  volume: 100, // GB
  duration: 30, // days
});

// دانلود config
const config = await adapter.downloadConfig(user.username);
```

---

## 7. MikroTik RouterOS

### وضعیت: ✅ کامل

**ویژگی‌ها:**
- HTTP Basic authentication
- RouterOS REST API
- مدیریت کاربران PPP/L2TP/PPTP
- مانیتورینگ ترافیک
- تخصیص profile به کاربران
- محدودیت حجم

### تنظیمات

```json
{
  "name": "MikroTik Router",
  "type": "MIKROTIK",
  "url": "http://192.168.88.1",
  "username": "admin",
  "password": "router_password",
  "inboundId": "default",
  "status": "ACTIVE"
}
```

### نکات مهم

- نیاز به فعال‌سازی REST API در RouterOS
- `inboundId` نام profile است (معمولاً `default`)
- Reset traffic پشتیبانی نمی‌شود
- برای عملکرد بهتر، از RouterOS v7+ استفاده کنید

### محدودیت‌ها

- ✅ ایجاد کاربر
- ✅ حذف کاربر
- ✅ مشاهده اطلاعات کاربر
- ✅ مدیریت حجم
- ❌ Reset traffic (نیاز به script سفارشی)
- ❌ Revoke subscription (کاربردی ندارد)

---

## استفاده عمومی

### افزودن پنل از طریق Admin Panel

1. دستور `/admin` را ارسال کنید
2. "🖥 مدیریت پنل‌ها" را انتخاب کنید
3. "➕ افزودن پنل" را بزنید
4. اطلاعات را وارد کنید:
   - نام پنل
   - نوع (MARZBAN, X_UI, ...)
   - URL
   - Username و Password
   - Inbound ID (اختیاری)

### افزودن پنل از طریق Database

```sql
INSERT INTO Panel (name, type, url, username, password, status, inboundId)
VALUES (
  'My VPN Panel',
  'MARZBAN',
  'https://panel.example.com',
  'admin',
  'secure_password',
  'ACTIVE',
  NULL
);
```

### استفاده برنامه‌نویسی

```typescript
import { PanelFactory } from './infrastructure/panels/PanelFactory';

// با نام پنل
const adapter = await PanelFactory.createFromName('My VPN Panel');

// با شی panel
const panelRecord = await prisma.panel.findUnique({
  where: { id: 1 }
});
const adapter = PanelFactory.create(panelRecord);

// ایجاد کاربر
const userInfo = await adapter.createUser({
  username: 'test_user_123',
  volume: 50, // GB
  duration: 30, // days
  inbounds: JSON.stringify(['vless', 'vmess']), // اختیاری
});

console.log('Subscription URL:', userInfo.subscriptionUrl);
console.log('Status:', userInfo.status);
console.log('Data Limit:', userInfo.dataLimit);
console.log('Expire:', new Date(userInfo.expire * 1000));
```

---

## Interface یکپارچه

همه Adapter‌ها این interface را پیاده‌سازی می‌کنند:

```typescript
interface IPanelAdapter {
  /**
   * احراز هویت با پنل
   */
  authenticate(): Promise<void>;

  /**
   * ایجاد کاربر جدید
   */
  createUser(input: CreateUserInput): Promise<PanelUserInfo>;

  /**
   * دریافت اطلاعات کاربر
   */
  getUser(username: string): Promise<PanelUserInfo | null>;

  /**
   * حذف کاربر
   */
  removeUser(username: string): Promise<void>;

  /**
   * ویرایش کاربر
   */
  modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void>;

  /**
   * رفع اشتراک (revoke)
   */
  revokeSubscription(username: string): Promise<string>;

  /**
   * ریست ترافیک مصرفی
   */
  resetDataUsage(username: string): Promise<void>;
}
```

### Input Types

```typescript
interface CreateUserInput {
  username: string;
  volume: number;    // در GB
  duration: number;  // در روز
  inbounds?: string; // JSON string
}

interface PanelUserInfo {
  username: string;
  status: 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold' | 'Unsuccessful';
  usedTraffic: number;    // در bytes
  dataLimit: number;      // در bytes
  expire: number;         // unix timestamp
  subscriptionUrl?: string;
}
```

---

## تست اتصال پنل

### از Admin Panel

1. `/admin` → "🖥 مدیریت پنل‌ها"
2. انتخاب پنل
3. "🔍 تست اتصال"
4. نتیجه را مشاهده کنید

### از کد

```typescript
try {
  const adapter = await PanelFactory.createFromName('My Panel');
  await adapter.authenticate();
  console.log('✅ اتصال موفق');
} catch (error) {
  console.error('❌ خطا:', error.message);
}
```

---

## عیب‌یابی رایج

### خطای "Panel not found"
- بررسی کنید پنل در دیتابیس وجود دارد
- وضعیت پنل `ACTIVE` باشد

### خطای "Authentication failed"
- Username و Password را چک کنید
- URL پنل درست باشد
- پنل در دسترس باشد (ping کنید)

### خطای "Timeout"
- اتصال اینترنت را بررسی کنید
- Firewall را چک کنید
- پنل روشن باشد

### خطای "Invalid inbound"
- `inboundId` درست باشد
- در پنل inbound با این شناسه وجود داشته باشد

---

## آمار پنل‌ها

| پنل | خطوط کد | Authentication | API Type | وضعیت |
|-----|---------|---------------|----------|-------|
| Marzban | 240 | Bearer Token | REST | ✅ |
| Marzneshin | - | Bearer Token | REST | ✅ |
| X-UI | 260 | Cookie | Custom | ✅ |
| S-UI | 210 | Bearer Token | REST | ✅ |
| Alireza | 280 | Cookie | Custom | ✅ |
| WGDashboard | 380 | API Key | REST | ✅ |
| MikroTik | 200 | Basic Auth | REST | ✅ |

---

## Roadmap

- [ ] افزودن Support برای Hiddify Panel
- [ ] افزودن Support برای V2Board
- [ ] پشتیبانی از Multi-inbound selection
- [ ] تست‌های یکپارچگی برای همه پنل‌ها
- [ ] مستندات API کامل‌تر برای هر پنل
- [ ] Panel health monitoring
- [ ] Auto-failover بین پنل‌ها

---

**آخرین به‌روزرسانی:** 2026-02-11  
**نسخه:** 1.0.0

