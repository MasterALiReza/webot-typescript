# 🎟️ Feature 03: Advanced Discount Code Management (مدیریت پیشرفته کد تخفیف)

## 📋 شرح فیچر
سیستم کامل مدیریت کدهای تخفیف شامل: ساخت، ویرایش، حذف، محدودیت استفاده، تاریخ انقضا، تخفیف درصدی/ثابت، محدودیت برای محصول خاص، و گزارش استفاده.

---

## 📊 وضعیت فعلی
### ✅ موجود:
- مدل `DiscountCode` در Prisma (code, percent, maxUses, usedCount, isActive, expiresAt)
- `DiscountHandler` با متدهای placeholder (کد comment شده)

### ❌ کمبود:
- متدهای DB واقعی کامنت شده‌اند (همه placeholder)
- نوع تخفیف ثابت (Fixed Amount) در schema نیست (فقط percent)
- محدودیت برای محصول خاص ندارد
- گزارش استفاده کاربران نیست
- اعمال در PurchaseHandler پیاده‌سازی نشده
- اعمال خودکار در Wallet charge ندارد

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: آپدیت Schema

**فایل:** `prisma/schema.prisma`

```prisma
model DiscountCode {
  id              Int       @id @default(autoincrement())
  code            String    @unique @db.VarChar(100)
  type            DiscountType @default(PERCENTAGE)
  amount          Decimal   @db.Decimal(12, 2)  // درصد یا مبلغ ثابت
  percent         Int?      // برای سازگاری
  maxUses         Int       @default(0) @map("max_uses")  // 0 = بی‌نهایت
  usedCount       Int       @default(0) @map("used_count")
  minOrderAmount  Decimal?  @map("min_order_amount") @db.Decimal(12, 2) // حداقل مبلغ سفارش
  maxDiscount     Decimal?  @map("max_discount") @db.Decimal(12, 2) // سقف تخفیف
  productId       Int?      @map("product_id")  // null = همه محصولات
  isActive        Boolean   @default(true) @map("is_active")
  expiresAt       DateTime? @map("expires_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  
  product         Product?  @relation(fields: [productId], references: [id])
  usages          DiscountUsage[]
  
  @@map("discount_codes")
}

enum DiscountType {
  PERCENTAGE   // درصدی
  FIXED        // مبلغ ثابت
}

model DiscountUsage {
  id              Int       @id @default(autoincrement())
  discountCodeId  Int       @map("discount_code_id")
  userId          Int       @map("user_id")
  amount          Decimal   @db.Decimal(12, 2)
  createdAt       DateTime  @default(now()) @map("created_at")
  
  discountCode    DiscountCode @relation(fields: [discountCodeId], references: [id])
  user            User         @relation(fields: [userId], references: [id])
  
  @@unique([discountCodeId, userId]) // هر کاربر فقط یکبار
  @@map("discount_usages")
}
```

### مرحله 2: Repository تخفیف

**فایل جدید:** `src/infrastructure/database/repositories/DiscountRepository.ts`

```typescript
import { prisma } from '../prisma';
import { DiscountType } from '@prisma/client';

export class DiscountRepository {
    async findByCode(code: string) {
        return prisma.discountCode.findUnique({
            where: { code: code.toUpperCase() },
            include: { usages: true },
        });
    }

    async create(data: {
        code: string;
        type: DiscountType;
        amount: number;
        maxUses?: number;
        minOrderAmount?: number;
        maxDiscount?: number;
        productId?: number;
        expiresAt?: Date;
    }) {
        return prisma.discountCode.create({
            data: {
                code: data.code.toUpperCase(),
                type: data.type,
                amount: data.amount,
                maxUses: data.maxUses || 0,
                minOrderAmount: data.minOrderAmount,
                maxDiscount: data.maxDiscount,
                productId: data.productId,
                expiresAt: data.expiresAt,
            },
        });
    }

    async applyDiscount(codeId: number, userId: number, amount: number) {
        return prisma.$transaction([
            prisma.discountCode.update({
                where: { id: codeId },
                data: { usedCount: { increment: 1 } },
            }),
            prisma.discountUsage.create({
                data: { discountCodeId: codeId, userId, amount },
            }),
        ]);
    }

    async validateCode(code: string, userId: number, orderAmount: number, productId?: number) {
        const discount = await this.findByCode(code);
        
        if (!discount || !discount.isActive) 
            return { valid: false, message: '❌ کد تخفیف نامعتبر است' };
        if (discount.expiresAt && discount.expiresAt < new Date()) 
            return { valid: false, message: '❌ کد تخفیف منقضی شده' };
        if (discount.maxUses > 0 && discount.usedCount >= discount.maxUses) 
            return { valid: false, message: '❌ ظرفیت کد تخفیف تمام شده' };
        if (discount.minOrderAmount && orderAmount < Number(discount.minOrderAmount))
            return { valid: false, message: `❌ حداقل مبلغ سفارش: ${discount.minOrderAmount} تومان` };
        if (discount.productId && productId && discount.productId !== productId)
            return { valid: false, message: '❌ این کد برای محصول انتخابی معتبر نیست' };
        
        // بررسی استفاده قبلی
        const used = discount.usages.find(u => u.userId === userId);
        if (used) return { valid: false, message: '❌ شما قبلاً از این کد استفاده کرده‌اید' };

        // محاسبه تخفیف
        let discountAmount: number;
        if (discount.type === 'PERCENTAGE') {
            discountAmount = orderAmount * Number(discount.amount) / 100;
            if (discount.maxDiscount) discountAmount = Math.min(discountAmount, Number(discount.maxDiscount));
        } else {
            discountAmount = Math.min(Number(discount.amount), orderAmount);
        }

        return {
            valid: true,
            discountId: discount.id,
            discountAmount,
            finalPrice: orderAmount - discountAmount,
            message: `✅ کد تخفیف اعمال شد: ${discountAmount.toLocaleString()} تومان تخفیف`,
        };
    }
}
```

### مرحله 3: اتصال به PurchaseHandler

**فایل:** `src/presentation/handlers/user/PurchaseHandler.ts`

```typescript
// اضافه کردن دکمه "وارد کردن کد تخفیف" به confirmPurchase
keyboard.text('🎟️ کد تخفیف', `discount:${productId}`);

// Handler جدید
async applyDiscountCode(ctx: Context, productId: number, code: string) {
    const product = await productRepo.findById(productId);
    const result = await discountRepo.validateCode(code, userId, Number(product.price), productId);
    
    if (result.valid) {
        // ذخیره تخفیف در session و نمایش قیمت نهایی
        await ctx.reply(`${result.message}\n💰 قیمت نهایی: ${result.finalPrice} تومان`);
    } else {
        await ctx.reply(result.message);
    }
}
```

---

## 📝 تست‌ها
1. کد درصدی 20% → محاسبه صحیح
2. کد ثابت 10000 تومان → کسر صحیح
3. کد منقضی → رد شود
4. کد با محدودیت مصرف → بعد از حد رد شود
5. کد برای محصول خاص → فقط آن محصول
6. استفاده تکراری → رد شود
