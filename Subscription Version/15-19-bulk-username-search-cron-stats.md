# 📦 Feature 15: Bulk Purchase (خرید عمده)

## 📋 شرح فیچر
خرید همزمان چندین سرویس با تخفیف عمده.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده

## 🛠️ پیاده‌سازی

### Schema
```prisma
model BulkPricing {
  id          Int     @id @default(autoincrement())
  productId   Int     @map("product_id")
  minQuantity Int     @map("min_quantity")
  discount    Int     // درصد تخفیف
  product     Product @relation(fields: [productId], references: [id])
  @@map("bulk_pricing")
}
```

### Handler
```typescript
export class BulkPurchaseHandler {
    static async showBulkOptions(ctx: Context, productId: number) {
        const pricings = await prisma.bulkPricing.findMany({
            where: { productId }, orderBy: { minQuantity: 'asc' },
        });
        let msg = '📦 <b>خرید عمده</b>\n\n';
        for (const p of pricings) {
            msg += `${p.minQuantity}+ عدد → ${p.discount}% تخفیف\n`;
        }
        // keyboard با انتخاب تعداد
    }
    
    static async executeBulkPurchase(ctx: Context, productId: number, quantity: number) {
        const product = await productRepo.findById(productId);
        const pricing = await prisma.bulkPricing.findFirst({
            where: { productId, minQuantity: { lte: quantity } },
            orderBy: { minQuantity: 'desc' },
        });
        
        const unitPrice = Number(product.price);
        const discount = pricing ? pricing.discount : 0;
        const total = unitPrice * quantity * (1 - discount / 100);
        
        // ساخت N سرویس
        for (let i = 0; i < quantity; i++) {
            const username = generateUsername(ctx.from!.id, i);
            await adapter.createUser({ username, volume: product.volume, duration: product.duration });
        }
    }
}
```

---

# 🔤 Feature 16: Username Generation Methods (روش‌های ساخت یوزرنیم)

## 📋 شرح فیچر
انتخاب روش ساخت یوزرنیم: تصادفی، ترکیبی (prefix + random)، یا دستی توسط کاربر.

## 📊 وضعیت فعلی: ⚠️ جزئی
- `PurchaseProductUseCase` یوزرنیم می‌سازد اما فقط یک روش دارد

## 🛠️ پیاده‌سازی

### Schema
```prisma
// BotSetting:
  usernameMethod    UsernameMethod @default(RANDOM)
  usernamePrefix    String?        @map("username_prefix") @db.VarChar(50)

enum UsernameMethod {
  RANDOM        // کاملاً تصادفی
  PREFIX_RANDOM // پیشوند + تصادفی
  CUSTOM        // انتخاب کاربر
  CHAT_ID       // بر اساس Chat ID
}
```

### Generator
```typescript
// src/shared/usernameGenerator.ts
export function generateUsername(method: UsernameMethod, prefix?: string, chatId?: bigint): string {
    switch (method) {
        case 'RANDOM':
            return `user_${randomString(8)}`;
        case 'PREFIX_RANDOM':
            return `${prefix || 'wb'}_${randomString(6)}`;
        case 'CHAT_ID':
            return `wb_${chatId}_${randomString(4)}`;
        case 'CUSTOM':
            return ''; // باید کاربر وارد کند
    }
}
```

---

# 🔍 Feature 17: Quick Service Search (جستجوی سریع سرویس)

## 📋 شرح فیچر
جستجوی سریع سرویس‌ها با یوزرنیم، chatId، یا وضعیت.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده

## 🛠️ پیاده‌سازی

```typescript
export class ServiceSearchHandler {
    static async handleSearch(ctx: Context, query: string) {
        // جستجو در invoices (سرویس‌ها)
        const services = await prisma.invoice.findMany({
            where: {
                OR: [
                    { username: { contains: query } },
                    { user: { chatId: isNaN(Number(query)) ? undefined : BigInt(query) } },
                    { user: { username: { contains: query } } },
                ],
            },
            include: { user: true, product: true },
            take: 20,
        });
        
        let msg = `🔍 <b>نتایج جستجو: "${query}"</b>\n\n`;
        for (const s of services) {
            const emoji = s.status === 'ACTIVE' ? '✅' : s.status === 'EXPIRED' ? '⏰' : '❌';
            msg += `${emoji} ${s.username} | ${s.user.firstName}\n`;
        }
        // نمایش با دکمه‌های مدیریت
    }
}
```

---

# ⏰ Feature 18: Advanced Cron Settings (تنظیمات Cron پیشرفته)

## 📋 شرح فیچر
تنظیم زمان‌بندی job‌ها از طریق پنل ادمین.

## 📊 وضعیت فعلی: ⚠️ جزئی
### ✅ موجود:
- 6 BullMQ Worker با زمان‌بندی hardcoded در `JobScheduler.ts`
- ExpiryWarning (هر ساعت), VolumeWarning (30 دقیقه), Cleanup (6 ساعت)

### ❌ کمبود:
- تنظیم از پنل ادمین ندارد
- ذخیره در DB نیست (hardcoded)
- تاریخچه اجرا ندارد

## 🛠️ پیاده‌سازی

### Schema
```prisma
model CronJob {
  id          Int      @id @default(autoincrement())
  name        String   @unique @db.VarChar(100)
  schedule    String   @db.VarChar(50) // cron expression
  isEnabled   Boolean  @default(true) @map("is_enabled")
  lastRun     DateTime? @map("last_run")
  nextRun     DateTime? @map("next_run")
  @@map("cron_jobs")
}
```

### Handler ادمین
```typescript
static async handleCronSettings(ctx: Context) {
    const jobs = await prisma.cronJob.findMany();
    let msg = '⏰ <b>تنظیمات زمان‌بندی</b>\n\n';
    for (const job of jobs) {
        const status = job.isEnabled ? '✅' : '❌';
        msg += `${status} ${job.name}: ${job.schedule}\n`;
        if (job.lastRun) msg += `   آخرین اجرا: ${job.lastRun.toLocaleString('fa-IR')}\n`;
    }
}

static async handleUpdateCron(ctx: Context, jobName: string, newSchedule: string) {
    await prisma.cronJob.update({ where: { name: jobName }, data: { schedule: newSchedule } });
    // ری‌استارت worker با schedule جدید
    await QueueManager.updateSchedule(jobName, newSchedule);
}
```

---

# 📊 Feature 19: Comprehensive Bot Statistics (آمار جامع ربات)

## 📋 شرح فیچر
داشبورد آمار کامل شامل: نمودار فروش، آمار کاربران، درآمد، پنل‌ها.

## 📊 وضعیت فعلی: ⚠️ جزئی
### ✅ موجود:
- `StatisticsHandler` با آمار کاربران، فروش، سرویس، پنل
- آمار روزانه/هفتگی/ماهانه

### ❌ کمبود:
- نمودار (chart) ندارد
- Export گزارش ندارد
- آمار مقایسه‌ای ندارد
- dashboard real-time نیست

## 🛠️ پیاده‌سازی

```typescript
// گسترش StatisticsHandler با روش‌های جدید:

static async handleAdvancedStats(ctx: Context) {
    const [daily, weekly, monthly] = await Promise.all([
        this.getDailyStats(7),   // 7 روز اخیر
        this.getWeeklyStats(4),  // 4 هفته اخیر
        this.getMonthlyStats(6), // 6 ماه اخیر
    ]);
    
    // تولید chart با QuickChart API
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
        type: 'line',
        data: {
            labels: daily.map(d => d.date),
            datasets: [{ label: 'درآمد', data: daily.map(d => d.revenue) }],
        },
    }))}`;
    
    await ctx.replyWithPhoto(chartUrl, { caption: '📊 نمودار درآمد 7 روز اخیر' });
}
```
