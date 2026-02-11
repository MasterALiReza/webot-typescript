# 🤝 Feature 04: Reseller Support (پشتیبانی نمایندگی)

## 📋 شرح فیچر
سیستم نمایندگی (Reseller) برای فروش سرویس‌ها از طریق واسطه‌ها با قابلیت تعریف تخفیف اختصاصی، پنل مستقل، و گزارش‌گیری فروش نمایندگان.

---

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده
- سیستم Affiliate پایه‌ای وجود دارد (AffiliateSetting) اما Reseller مستقیم نیست

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: Schema جدید

```prisma
model Reseller {
  id              Int       @id @default(autoincrement())
  userId          Int       @unique @map("user_id")
  level           ResellerLevel @default(BRONZE)
  discountPercent Int       @default(10) @map("discount_percent")
  commission      Int       @default(5) // درصد کمیسیون
  maxUsers        Int       @default(100) @map("max_users")
  totalSales      Decimal   @default(0) @map("total_sales") @db.Decimal(12, 2)
  isActive        Boolean   @default(true) @map("is_active")
  panelId         Int?      @map("panel_id") // پنل اختصاصی نماینده
  createdAt       DateTime  @default(now()) @map("created_at")
  
  user            User      @relation(fields: [userId], references: [id])
  panel           Panel?    @relation(fields: [panelId], references: [id])
  sales           ResellerSale[]
  
  @@map("resellers")
}

enum ResellerLevel {
  BRONZE
  SILVER
  GOLD
  PLATINUM
}

model ResellerSale {
  id          Int       @id @default(autoincrement())
  resellerId  Int       @map("reseller_id")
  invoiceId   Int       @map("invoice_id")
  commission  Decimal   @db.Decimal(12, 2)
  createdAt   DateTime  @default(now()) @map("created_at")
  
  reseller    Reseller  @relation(fields: [resellerId], references: [id])
  invoice     Invoice   @relation(fields: [invoiceId], references: [id])
  
  @@map("reseller_sales")
}
```

### مرحله 2: Handler نمایندگی

**فایل جدید:** `src/presentation/handlers/admin/ResellerHandler.ts`

```typescript
export class ResellerHandler {
    // لیست نمایندگان
    static async handleResellersMenu(ctx: Context): Promise<void> { /* ... */ }
    // افزودن نماینده
    static async handleAddReseller(ctx: Context, userId: number, level: ResellerLevel): Promise<void> { /* ... */ }
    // مشاهده فروش نماینده
    static async handleResellerSales(ctx: Context, resellerId: number): Promise<void> { /* ... */ }
    // تغییر سطح نماینده
    static async handleChangeLevel(ctx: Context, resellerId: number, newLevel: ResellerLevel): Promise<void> { /* ... */ }
    // تنظیم تخفیف اختصاصی
    static async handleSetDiscount(ctx: Context, resellerId: number, percent: number): Promise<void> { /* ... */ }
}
```

### مرحله 3: پنل نمایندگی (Handler کاربری)

**فایل جدید:** `src/presentation/handlers/user/ResellerPanelHandler.ts`

```typescript
export class ResellerPanelHandler {
    // نمایش پنل نماینده
    static async showResellerPanel(ctx: Context): Promise<void> {
        const user = await userRepo.findByChatId(BigInt(ctx.from!.id));
        const reseller = await prisma.reseller.findUnique({ where: { userId: user!.id } });
        
        if (!reseller) {
            await ctx.reply('⛔️ شما نماینده فعال نیستید.');
            return;
        }

        let message = `🤝 <b>پنل نمایندگی</b>\n\n`;
        message += `📊 سطح: ${reseller.level}\n`;
        message += `💰 کل فروش: ${reseller.totalSales}\n`;
        message += `🎁 تخفیف: ${reseller.discountPercent}%\n`;
        message += `💵 کمیسیون: ${reseller.commission}%\n`;
        // ...
    }
    
    // خرید با تخفیف نمایندگی
    static async purchaseAsReseller(ctx: Context, productId: number): Promise<void> {
        // اعمال تخفیف نمایندگی به قیمت
        // ثبت فروش در ResellerSale
        // محاسبه و واریز کمیسیون
    }
}
```

### مرحله 4: اتصال در index.ts

```typescript
bot.hears('🤝 پنل نمایندگی', (ctx) => ResellerPanelHandler.showResellerPanel(ctx));
bot.callbackQuery('admin:resellers', adminAuthMiddleware(['SUPER_ADMIN', 'ADMIN']), ResellerHandler.handleResellersMenu);
```

---

## 📝 تست‌ها
1. ایجاد نماینده با تخفیف 15% → خرید با قیمت تخفیف‌دار
2. ثبت کمیسیون 5% → واریز خودکار به کیف پول
3. نمایش آمار فروش نماینده
4. ارتقا سطح نماینده → تغییر تخفیف و کمیسیون

---

# 💰 Feature 05: Refund and Service Removal (بازپرداخت و حذف سرویس)

## 📋 شرح فیچر
امکان بازپرداخت وجه به کاربر و حذف سرویس از پنل VPN به‌صورت خودکار.

---

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده
- `IPanelAdapter.removeUser()` وجود دارد
- `PaymentStatus.REFUNDED` در schema هست
- لاجیک بازپرداخت و فرآیند کامل پیاده‌سازی نشده

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: Schema تکمیلی

```prisma
model RefundRequest {
  id          Int          @id @default(autoincrement())
  userId      Int          @map("user_id")
  invoiceId   Int          @map("invoice_id")
  amount      Decimal      @db.Decimal(12, 2)
  reason      String       @db.Text
  status      RefundStatus @default(PENDING)
  adminNote   String?      @map("admin_note") @db.Text
  processedBy Int?         @map("processed_by")
  createdAt   DateTime     @default(now()) @map("created_at")
  processedAt DateTime?    @map("processed_at")
  
  user        User         @relation(fields: [userId], references: [id])
  invoice     Invoice      @relation(fields: [invoiceId], references: [id])
  
  @@map("refund_requests")
}

enum RefundStatus {
  PENDING
  APPROVED
  REJECTED
  PROCESSED
}
```

### مرحله 2: Use Case بازپرداخت

**فایل جدید:** `src/application/use-cases/RefundService.ts`

```typescript
export class RefundServiceUseCase {
    async execute(input: { invoiceId: number; reason: string; adminId?: number }): Promise<RefundResult> {
        const invoice = await invoiceRepo.findById(input.invoiceId);
        if (!invoice) throw new Error('Invoice not found');
        
        // 1. حذف سرویس از پنل
        const panel = await panelRepo.findById(invoice.panelId);
        const adapter = PanelFactory.create(panel);
        await adapter.authenticate();
        await adapter.removeUser(invoice.username);
        
        // 2. محاسبه مبلغ بازپرداخت (بر اساس زمان مصرف‌شده)
        const usedDays = Math.ceil((Date.now() - invoice.createdAt.getTime()) / 86400000);
        const totalDays = invoice.product.duration;
        const refundRatio = Math.max(0, (totalDays - usedDays) / totalDays);
        const refundAmount = Number(invoice.productPrice) * refundRatio;
        
        // 3. واریز به کیف پول
        await userRepo.addBalance(invoice.userId, refundAmount);
        
        // 4. آپدیت invoice
        await invoiceRepo.update(invoice.id, { status: 'REMOVED' });
        
        return { success: true, refundAmount };
    }
}
```

### مرحله 3: Handler ادمین

```typescript
// در AdminHandler - دکمه بازپرداخت
static async handleRefundMenu(ctx: Context, invoiceId: number): Promise<void> {
    const invoice = await invoiceRepo.findById(invoiceId);
    // نمایش اطلاعات سفارش + محاسبه مبلغ بازپرداخت
    // دکمه‌های: تایید بازپرداخت، رد بازپرداخت، بازگشت
}

static async handleApproveRefund(ctx: Context, invoiceId: number): Promise<void> {
    const useCase = new RefundServiceUseCase();
    const result = await useCase.execute({ invoiceId, adminId: ctx.from!.id });
    await ctx.editMessageText(`✅ بازپرداخت انجام شد: ${result.refundAmount} تومان`);
}
```

---

## 📝 تست‌ها
1. بازپرداخت سرویس 30 روزه بعد از 10 روز → 2/3 مبلغ
2. حذف سرویس از پنل → تایید حذف
3. واریز به کیف پول → بررسی موجودی
4. بازپرداخت سرویس منقضی → رد شود

---

# ⚡ Feature 06: Advanced Panel-Specific Bandwidth Management (مدیریت پیشرفته پهنای باند)

## 📋 شرح فیچر
مدیریت دقیق پهنای باند هر پنل شامل: مشاهده مصرف real-time، تنظیم محدودیت سرعت، آلارم‌ها، و throttling.

---

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده
- `IPanelAdapter.getSystemStats()` وجود دارد (optional)
- `VolumeWarningWorker` مصرف حجم کاربران را چک می‌کند
- مدیریت پهنای باند در سطح پنل ندارد

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: گسترش IPanelAdapter

```typescript
export interface IPanelAdapter {
    // ... متدهای موجود ...
    
    // متدهای جدید برای مدیریت پهنای باند
    getBandwidthStats?(): Promise<BandwidthStats>;
    setSpeedLimit?(username: string, uploadLimit: number, downloadLimit: number): Promise<void>;
    getActiveConnections?(): Promise<number>;
    getTrafficByUser?(username: string): Promise<TrafficInfo>;
}

interface BandwidthStats {
    totalUpload: number;      // bytes
    totalDownload: number;    // bytes
    currentUpload: number;    // bytes/s
    currentDownload: number;  // bytes/s
    activeUsers: number;
}

interface TrafficInfo {
    upload: number;
    download: number;
    lastActivity: Date;
}
```

### مرحله 2: پنل مانیتورینگ

**فایل جدید:** `src/presentation/handlers/admin/BandwidthHandler.ts`

```typescript
export class BandwidthHandler {
    static async handleBandwidthMenu(ctx: Context): Promise<void> {
        const panels = await panelRepo.findAll();
        
        let message = '⚡ <b>مانیتورینگ پهنای باند</b>\n\n';
        
        for (const panel of panels) {
            const adapter = PanelFactory.create(panel);
            await adapter.authenticate();
            const stats = await adapter.getBandwidthStats?.();
            
            if (stats) {
                message += `🖥 ${panel.name}\n`;
                message += `├ ⬆️ Upload: ${formatBytes(stats.currentUpload)}/s\n`;
                message += `├ ⬇️ Download: ${formatBytes(stats.currentDownload)}/s\n`;
                message += `├ 👥 Active: ${stats.activeUsers}\n`;
                message += `└ 📊 Total: ${formatBytes(stats.totalDownload)}\n\n`;
            }
        }
        // نمایش با inline keyboard
    }
    
    static async handleSetSpeedLimit(ctx: Context, panelId: number, username: string, 
        upload: number, download: number): Promise<void> {
        const panel = await panelRepo.findById(panelId);
        const adapter = PanelFactory.create(panel);
        await adapter.authenticate();
        await adapter.setSpeedLimit?.(username, upload, download);
        await ctx.answerCallbackQuery({ text: '✅ محدودیت سرعت اعمال شد' });
    }
}
```

---

## 📝 تست‌ها
1. مشاهده مصرف real-time هر پنل
2. اعمال محدودیت سرعت 10 Mbps بر یک کاربر
3. آلارم مصرف بالا
4. گزارش مصرف روزانه/هفتگی/ماهانه
