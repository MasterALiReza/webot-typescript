# 🔄 Feature 11: Renewal and Volume Purchases (تمدید و خرید حجم)

## 📋 شرح فیچر
امکان تمدید سرویس‌های موجود و خرید حجم اضافه.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده
- `IPanelAdapter.modifyUser()` وجود دارد
- Handler تمدید ندارد

## 🛠️ راهنمای پیاده‌سازی

### Schema
```prisma
model RenewalOption {
  id          Int     @id @default(autoincrement())
  productId   Int     @map("product_id")
  type        RenewalType
  duration    Int?    // روز
  volume      Int?    // GB
  price       Decimal @db.Decimal(12, 2)
  product     Product @relation(fields: [productId], references: [id])
  @@map("renewal_options")
}

enum RenewalType {
  EXTEND_TIME
  ADD_VOLUME
  FULL_RENEWAL
}
```

### Use Case
**فایل:** `src/application/use-cases/RenewService.ts`

```typescript
export class RenewServiceUseCase {
    async execute(invoiceId: number, optionId: number): Promise<RenewalResult> {
        const invoice = await invoiceRepo.findById(invoiceId);
        const option = await prisma.renewalOption.findUnique({ where: { id: optionId } });
        const adapter = PanelFactory.create(await panelRepo.findById(invoice.panelId));
        await adapter.authenticate();
        
        switch (option.type) {
            case 'EXTEND_TIME':
                await adapter.modifyUser(invoice.username, { duration: option.duration });
                break;
            case 'ADD_VOLUME':
                await adapter.modifyUser(invoice.username, { volume: option.volume });
                break;
            case 'FULL_RENEWAL':
                await adapter.modifyUser(invoice.username, { 
                    duration: option.duration, volume: option.volume 
                });
                break;
        }
        return { success: true };
    }
}
```

---

# 💳 Feature 12: Inventory Control (کنترل موجودی)

## 📋 شرح فیچر
تنظیم حداقل/حداکثر شارژ کیف پول و کنترل موجودی محصولات.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده

## 🛠️ راهنمای پیاده‌سازی

### Schema اضافه‌ها
```prisma
// BotSetting:
  minChargeAmount   Decimal  @default(10000) @db.Decimal(12, 2)
  maxChargeAmount   Decimal  @default(5000000) @db.Decimal(12, 2)
  
// Product:
  stock             Int      @default(-1) // -1 = بی‌نهایت
  soldCount         Int      @default(0)
  lowStockAlert     Int      @default(5)
```

### Validation
```typescript
// WalletHandler
if (amount < settings.minChargeAmount) return ctx.reply('❌ حداقل مبلغ شارژ رعایت نشده');
if (amount > settings.maxChargeAmount) return ctx.reply('❌ حداکثر مبلغ شارژ رعایت نشده');

// PurchaseHandler
if (product.stock !== -1 && product.stock <= 0) return ctx.reply('❌ ناموجود');
```

---

# 📩 Feature 13: Support Messages (پیام‌های پشتیبانی)

## 📋 شرح فیچر
سیستم تیکت پشتیبانی مکالمه‌ای با اعلان‌ها.

## 📊 وضعیت فعلی: ⚠️ جزئی
- مدل `SupportTicket` موجود (تک‌پیام)
- مکالمه‌ای نیست، Handler ندارد

## 🛠️ پیاده‌سازی

### Schema مکالمه‌ای
```prisma
model TicketMessage {
  id        Int      @id @default(autoincrement())
  ticketId  Int      @map("ticket_id")
  senderId  BigInt
  isAdmin   Boolean  @default(false)
  message   String   @db.Text
  fileId    String?  @db.VarChar(500)
  createdAt DateTime @default(now())
  ticket    SupportTicket @relation(fields: [ticketId], references: [id])
  @@map("ticket_messages")
}
```

### Handler کاربر
```typescript
static async handleNewTicket(ctx: Context) {
    await ctx.reply('📩 موضوع تیکت:');
    // set step: awaiting_ticket_subject
}
static async handleSendMessage(ctx: Context, ticketId: number) {
    await prisma.ticketMessage.create({ data: { ticketId, senderId: BigInt(ctx.from!.id), message: ctx.message!.text! }});
    await bot.api.sendMessage(adminChatId, `📩 پیام جدید تیکت #${ticketId}`);
}
```

---

# 🔗 Feature 14: Advanced Affiliate (زیرمجموعه پیشرفته)

## 📋 شرح فیچر
Multi-level affiliate با پاداش چندسطحی.

## 📊 وضعیت فعلی: ⚠️ جزئی
- `AffiliateSetting` و `User.refCode/referredBy` موجود
- فقط 1 سطح، بدون گزارش

## 🛠️ پیاده‌سازی

### Schema
```prisma
model AffiliateLevel {
  id              Int  @id @default(autoincrement())
  level           Int  @unique
  rewardPercent   Int
  discountPercent Int
  @@map("affiliate_levels")
}

model AffiliateTransaction {
  id          Int      @id @default(autoincrement())
  referrerId  Int
  referredId  Int
  invoiceId   Int
  level       Int
  amount      Decimal  @db.Decimal(12, 2)
  createdAt   DateTime @default(now())
  @@map("affiliate_transactions")
}
```

### محاسبه پاداش
```typescript
async processRewards(buyerId: number, invoiceAmount: number) {
    let currentId = buyerId;
    for (let level = 1; level <= 3; level++) {
        const user = await prisma.user.findUnique({ where: { id: currentId } });
        if (!user?.referredBy) break;
        const referrer = await prisma.user.findUnique({ where: { chatId: user.referredBy } });
        if (!referrer) break;
        const lvl = await prisma.affiliateLevel.findUnique({ where: { level } });
        if (!lvl) break;
        const reward = invoiceAmount * lvl.rewardPercent / 100;
        await prisma.user.update({ where: { id: referrer.id }, data: { balance: { increment: reward } }});
        currentId = referrer.id;
    }
}
```
