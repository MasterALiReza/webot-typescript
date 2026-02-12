# مقایسه کامل پنل‌ها و ویژگی‌ها

## پنل‌های پیاده‌سازی شده ✅

### ✅ Marzban
- **وضعیت**: کامل و تست شده
- **فایل**: `MarzbanAdapter.ts`
- **ویژگی‌ها**:
  - Token caching (50 دقیقه)
  - Create/Get/Remove/Modify User
  - Revoke Subscription
  - Reset Data Usage
  - System Stats

### ✅ X-UI (3x-ui)
- **وضعیت**: کامل
- **فایل**: `XUIAdapter.ts`
- **ویژگی‌ها**:
  - Session cookie management
  - UUID generation
  - Full CRUD operations
  - Subscription management

### ✅ S-UI Panel
- **وضعیت**: کامل
- **فایل**: `SUIPanelAdapter.ts`
- **ویژگی‌ها**:
  - Multi-protocol support
  - Session management
  - Complete adapter implementation

### ⚠️ WGDashboard (WireGuard)
- **وضعیت**: Stub Implementation
- **فایل**: `WGDashboardAdapter.ts`
- **توضیح**: فقط skeleton ساخته شده، نیاز به پیاده‌سازی کامل

### ⚠️ MikroTik
- **وضعیت**: Stub Implementation
- **فایل**: `MikrotikAdapter.ts`
- **توضیح**: فقط skeleton، نیاز به RouterOS API

## پنل‌های موجود در پروژه اصلی (botmirzapanel-main) ❌

### ❌ Marzneshin
- **وضعیت**: **MISSING** - نداریم!
- **فایل اصلی**: `marzneshin.php`
- **API Endpoint**: `/api/users/` (جای `/api/user/`)
- **تفاوت با Marzban**:
  - از `service_ids` استفاده می‌کند (نه `proxies`)
  - دارای `expire_strategy`: `never`, `fixed_date`, `start_on_first_use`
  - دارای `usage_duration` برای on-hold
  - دارای `on_hold_expire_duration`
  - API path متفاوت: `/api/admins/token` و `/api/users/`

### ❌ Alireza (x-ui variant)
- **وضعیت**: **MISSING** - نداریم!
- **فایل اصلی**: `alireza_single.php`
- **API Endpoints**:
  - `/xui/API/inbounds/getClientTraffics/{username}`
  - `/xui/API/inbounds/addClient`
  - `/xui/API/inbounds/updateClient/{id}`
  - `/xui/API/inbounds/{id}/delClient/{clientId}`
  - `/xui/API/inbounds/onlines`
- **ویژگی‌ها**:
  - Cookie-based authentication
  - `/login` endpoint
  - تفاوت در structure نسبت به X-UI عادی

## ویژگی‌های Payment Gateway

### درگاه‌های موجود در اصل:

1. **NowPayments** ✅
   - پوشه: `payment/nowpayments/`
   - وضعیت: **پیاده‌سازی شده** در TypeScript

2. **Aqaye Pardakht** ❌
   - پوش: `payment/aqayepardakht/`
   - وضعیت: **MISSING** - نداریم!
   - درگاه بانکی ایرانی

3. **Card-to-Card Manual** ✅
   - وضعیت: **پیاده‌سازی شده**

4. **Zarinpal** ✅
   - وضعیت: **پیاده‌سازی شده**

## Cron Jobs  (BullMQ Queues)

### موجود در پروژه اصلی:

1. **cronday.php** - Expiry Warning ❌
   - بررسی انقضای سرویس‌ها
   - ارسال هشدار 1، 3، 7 روز قبل از انقضا

2. **cronvolume.php** - Volume Warning ❌
   - بررسی حجم مصرفی
   - هشدار 80%، 90% مصرف

3. **croncard.php** - Auto Card Payment ❌
   - بررسی پرداخت‌های کارت به کارت
   - تایید خودکار یا دستی

4. **removeexpire.php** - Expired Service Removal ❌
   - حذف سرویس‌های منقضی شده
   - از همه پنل‌ها

5. **configtest.php** - Test Config Cleanup ❌
   - پاکسازی کانفیگ‌های تستی

6. **sendmessage.php** - Broadcast Messages ❌
   - ارسال پیام انبوه

## خلاصه وضعیت

| مورد | وضعیت در TypeScript | اولویت |
|------|---------------------|---------|
| **Marzban** | ✅ کامل | - |
| **X-UI** | ✅ کامل | - |
| **S-UI** | ✅ کامل | - |
| **WGDashboard** | ⚠️ Stub | متوسط |
| **MikroTik** | ⚠️ Stub | پایین |
| **Marzneshin** | ❌ ندارد | **بالا** |
| **Alireza (x-ui variant)** | ❌ ندارد | متوسط |
| **Aqaye Pardakht** | ❌ ندارد | متوسط |
| **Cron Jobs (6 عدد)** | ❌ ندارد | **بالا** |

## پیشنهاد اولویت‌بندی

### فاز 1 - ضروری:
1. ✅ Marzban Adapter
2. ✅ Payment Gateways (Zarinpal, NowPayments, Card-to-Card)
3. ❌ **Marzneshin Adapter** - بسیار مهم
4. ❌ **Cron Jobs Setup** - BullMQ با Redis

### فاز 2 - مهم:
5. ⚠️ WGDashboard - کامل کردن
6. ❌ Alireza Adapter
7. ❌ Aqaye Pardakht Gateway

### فاز 3 - اختیاری:
8. ⚠️ MikroTik - کامل کردن

## نتیجه‌گیری

**موارد کلیدی که نداریم:**
1. **Marzneshin Panel Adapter** - یکی از پنل‌های اصلی
2. **Alireza Panel Adapter** - variant خاص x-ui
3. **Aqaye Pardakht Payment Gateway**
4. **6 Cron Job** برای مدیریت خودکار (expirations، warnings، cleanups)

**وضعیت پنل‌ها:**
- ✅ 3 پنل کامل (Marzban, X-UI, S-UI)
- ⚠️ 2 پنل Stub (WGDashboard, MikroTik)
- ❌ 2 پنل ناقص (Marzneshin, Alireza)
