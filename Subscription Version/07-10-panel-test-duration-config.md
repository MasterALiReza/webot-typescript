# 🔄 Feature 07: Panel Status Management (مدیریت وضعیت پنل)

## 📋 شرح فیچر
مدیریت کامل وضعیت پنل‌ها شامل: فعال/غیرفعال کردن، تست اتصال، مانیتورینگ خودکار، و failover.

---

## 📊 وضعیت فعلی: ⚠️ جزئی
### ✅ موجود:
- `PanelStatus` enum (ACTIVE/INACTIVE)
- دکمه‌های فعال/غیرفعال و تست اتصال در `PanelManagementHandler`

### ❌ کمبود:
- مانیتورینگ خودکار (health check) ندارد
- Failover خودکار بین پنل‌ها نیست
- نوتیفیکیشن قطع شدن پنل ندارد
- آمار uptime نیست

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: Schema تکمیلی

```prisma
// اضافه به model Panel:
  lastHealthCheck  DateTime? @map("last_health_check")
  uptimePercent    Decimal   @default(100) @map("uptime_percent") @db.Decimal(5, 2)
  totalChecks      Int       @default(0) @map("total_checks")
  failedChecks     Int       @default(0) @map("failed_checks")
  maxConfigs       Int       @default(0) @map("max_configs") // 0 = بدون محدودیت
  currentConfigs   Int       @default(0) @map("current_configs")
```

### مرحله 2: BullMQ Worker مانیتورینگ

**فایل جدید:** `src/infrastructure/queue/workers/PanelHealthCheckWorker.ts`

```typescript
export class PanelHealthCheckWorker {
    async process(): Promise<void> {
        const panels = await prisma.panel.findMany({ where: { status: 'ACTIVE' } });
        
        for (const panel of panels) {
            try {
                const adapter = PanelFactory.create(panel);
                await adapter.authenticate();
                const stats = await adapter.getSystemStats?.();
                
                // بروزرسانی وضعیت
                await prisma.panel.update({
                    where: { id: panel.id },
                    data: {
                        lastHealthCheck: new Date(),
                        totalChecks: { increment: 1 },
                    },
                });
            } catch (error) {
                // ثبت خطا + نوتیفیکیشن
                await prisma.panel.update({
                    where: { id: panel.id },
                    data: {
                        failedChecks: { increment: 1 },
                        totalChecks: { increment: 1 },
                    },
                });
                
                // اطلاع به ادمین
                await bot.api.sendMessage(adminChatId, 
                    `⚠️ پنل ${panel.name} پاسخ نمی‌دهد!\n🔗 ${panel.url}`);
                
                // غیرفعال خودکار اگر 3 بار متوالی fail
                if (panel.failedChecks >= 3) {
                    await prisma.panel.update({
                        where: { id: panel.id },
                        data: { status: 'INACTIVE' },
                    });
                }
            }
        }
    }
}
```

### مرحله 3: ثبت در JobScheduler

```typescript
// Health check هر 5 دقیقه
await QueueManager.scheduleRecurringJob(
    'panel-health-check',
    '*/5 * * * *',
    { batchSize: 5 }
);
```

---

# 🔑 Feature 08: Separate Panels for Test Accounts (پنل جدا برای حساب تست)

## 📋 شرح فیچر
اختصاص پنل‌های جداگانه مخصوص حساب‌های تست تا از پنل‌های اصلی production جدا باشند.

---

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده
- `BotSetting.testAccountLimit` وجود دارد
- `TestConfigCleanupWorker` موجود است
- تفکیک پنل تست از production در schema نیست

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: Schema

```prisma
// اضافه به model Panel:
  isTestPanel     Boolean   @default(false) @map("is_test_panel")
  testDuration    Int       @default(1) @map("test_duration") // روز
  testVolume      Int       @default(1) @map("test_volume")   // GB
```

### مرحله 2: لاجیک ساخت حساب تست

```typescript
// در PurchaseHandler یا TestAccountHandler
async createTestAccount(ctx: Context): Promise<void> {
    // 1. بررسی محدودیت تست کاربر
    if (user.limitUserTest >= settings.testAccountLimit) {
        await ctx.reply('❌ شما به حد مجاز حساب تست رسیده‌اید.');
        return;
    }
    
    // 2. انتخاب پنل تست (نه production)
    const testPanel = await prisma.panel.findFirst({
        where: { isTestPanel: true, status: 'ACTIVE' },
    });
    
    if (!testPanel) {
        await ctx.reply('⚠️ پنل تست در دسترس نیست.');
        return;
    }
    
    // 3. ساخت حساب در پنل تست
    const adapter = PanelFactory.create(testPanel);
    await adapter.authenticate();
    const user = await adapter.createUser({
        username: `test_${chatId}_${Date.now()}`,
        volume: testPanel.testVolume,
        duration: testPanel.testDuration,
    });
    
    // 4. ثبت و ارسال کانفیگ
    await ctx.reply(`✅ حساب تست ایجاد شد!\n⏰ مدت: ${testPanel.testDuration} روز\n📊 حجم: ${testPanel.testVolume} GB`);
}
```

---

# ⏳ Feature 09: Set Service Purchase Durations (تنظیم مدت سرویس)

## 📋 شرح فیچر
امکان تعریف مدت‌های مختلف خرید سرویس (1 ماهه، 3 ماهه، 6 ماهه، سالانه) با قیمت‌گذاری جداگانه.

---

## 📊 وضعیت فعلی: ⚠️ جزئی
### ✅ موجود:
- `Product.duration` (int, روز)
- ادمین می‌تواند محصولات با duration مختلف بسازد

### ❌ کمبود:
- قیمت‌گذاری هوشمند بر اساس duration ندارد
- template برای یک سرویس با مدت‌های مختلف نیست
- تخفیف خودکار برای مدت‌های بلندتر

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: Schema

```prisma
model ProductDuration {
  id          Int     @id @default(autoincrement())
  productId   Int     @map("product_id")
  duration    Int     // روز
  price       Decimal @db.Decimal(12, 2)
  discount    Int     @default(0) // درصد تخفیف نسبت به یک‌ماهه
  isDefault   Boolean @default(false) @map("is_default")
  
  product     Product @relation(fields: [productId], references: [id])
  
  @@map("product_durations")
}
```

### مرحله 2: آپدیت PurchaseHandler

```typescript
async showDurationOptions(ctx: Context, productId: number) {
    const durations = await prisma.productDuration.findMany({
        where: { productId },
        orderBy: { duration: 'asc' },
    });
    
    const keyboard = new InlineKeyboard();
    for (const d of durations) {
        const label = d.discount > 0 
            ? `${d.duration} روز - ${d.price} تومان (${d.discount}% تخفیف)` 
            : `${d.duration} روز - ${d.price} تومان`;
        keyboard.text(label, `buy:${productId}:${d.id}`).row();
    }
}
```

---

# 📤 Feature 10: Send Config Directly After Payment (ارسال کانفیگ بعد از پرداخت)

## 📋 شرح فیچر
ارسال خودکار و فوری کانفیگ VPN بلافاصله پس از تایید پرداخت (بدون نیاز به مداخله ادمین).

---

## 📊 وضعیت فعلی: ⚠️ جزئی
### ✅ موجود:
- `PurchaseHandler.executePurchase()` سرویس می‌سازد و لینک اشتراک ارسال می‌کند
- `PurchaseProductUseCase` فرآیند خرید را مدیریت می‌کند

### ❌ کمبود:
- بعد از پرداخت آنلاین (Zarinpal/AqayePardakht) خودکار trigger نمی‌شود
- QR Code ارسال نمی‌شود
- کانفیگ به فرمت‌های مختلف (V2Ray, Clash, Shadowsocks) ارسال نمی‌شود

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: گسترش IPanelAdapter

```typescript
export interface IPanelAdapter {
    // ... متدهای موجود ...
    getConfigs?(username: string): Promise<ConfigInfo[]>;
}

interface ConfigInfo {
    protocol: string;      // vmess, vless, trojan, etc.
    configUrl: string;     // لینک کانفیگ
    qrCode?: Buffer;       // تصویر QR Code
    format: 'v2ray' | 'clash' | 'shadowsocks';
}
```

### مرحله 2: ارسال خودکار پس از پرداخت

```typescript
// در PaymentHandler - بعد از verify موفق:
async onPaymentVerified(userId: number, invoiceId: number) {
    const invoice = await invoiceRepo.findById(invoiceId);
    const panel = await panelRepo.findById(invoice.panelId);
    const adapter = PanelFactory.create(panel);
    await adapter.authenticate();
    
    // دریافت کانفیگ‌ها
    const configs = await adapter.getConfigs?.(invoice.username);
    
    // ارسال لینک اشتراک
    await bot.api.sendMessage(user.chatId, 
        `✅ پرداخت تایید شد!\n\n🔗 لینک اشتراک:\n<code>${invoice.subscriptionUrl}</code>`,
        { parse_mode: 'HTML' });
    
    // ارسال QR Code
    if (configs?.[0]?.qrCode) {
        await bot.api.sendPhoto(user.chatId, new InputFile(configs[0].qrCode));
    }
    
    // ارسال کانفیگ‌ها
    for (const config of configs || []) {
        await bot.api.sendMessage(user.chatId,
            `📱 ${config.protocol.toUpperCase()}:\n<code>${config.configUrl}</code>`,
            { parse_mode: 'HTML' });
    }
}
```

---

## 📝 تست‌ها
1. پرداخت → ارسال فوری کانفیگ (< 5 ثانیه)
2. ارسال QR Code قابل اسکن
3. ارسال فرمت‌های مختلف V2Ray/Clash
4. تایید Card-to-Card → trigger خودکار
