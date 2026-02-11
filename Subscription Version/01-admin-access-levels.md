# 🔐 Feature 01: Admin Access Levels (سطوح دسترسی ادمین)

## 📋 شرح فیچر

سیستم مدیریت سطوح دسترسی ادمین برای تفکیک نقش‌ها و محدود کردن دسترسی هر ادمین بر اساس نقش تعریف‌شده.

### نقش‌ها:
| نقش | دسترسی‌ها |
|-----|----------|
| **SUPER_ADMIN** | دسترسی کامل به تمام بخش‌ها |
| **ADMIN** (مدیریت) | مدیریت کاربران، محصولات، پنل‌ها |
| **SALES** (فروش) | مشاهده سفارشات، مدیریت پرداخت‌ها |
| **SUPPORT** (پشتیبانی) | پاسخ به تیکت‌ها، مشاهده کاربران |

---

## 📊 وضعیت فعلی در پروژه

### ✅ موجود:
- مدل `Admin` در `prisma/schema.prisma` با `AdminRole` enum شامل 4 نقش
- Middleware `adminAuthMiddleware` در `src/presentation/middlewares/adminAuthMiddleware.ts`

### ❌ کمبود:
- `AdminHandler.isAdmin()` فقط از `config.ADMIN_CHAT_ID` استفاده می‌کند (chatId-based)، نه از جدول `Admin`
- فیلتر دسترسی بر اساس نقش‌ها پیاده‌سازی نشده
- مدیریت ادمین‌ها (افزودن/حذف/تغییر نقش) فقط placeholder است

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: آپدیت Middleware احراز هویت ادمین

**فایل:** `src/presentation/middlewares/adminAuthMiddleware.ts`

```typescript
import { Context, NextFunction } from 'grammy';
import { prisma } from '../../infrastructure/database/prisma';
import { AdminRole } from '@prisma/client';

/**
 * بررسی دسترسی ادمین بر اساس نقش
 * @param allowedRoles نقش‌های مجاز - اگر خالی باشد همه ادمین‌ها دسترسی دارند
 */
export function adminAuthMiddleware(allowedRoles?: AdminRole[]) {
    return async (ctx: Context, next: NextFunction) => {
        if (!ctx.from) {
            await ctx.reply('⛔️ خطای احراز هویت');
            return;
        }

        const chatId = BigInt(ctx.from.id);

        // بررسی در جدول Admin
        const admin = await prisma.admin.findUnique({
            where: { chatId },
        });

        if (!admin) {
            await ctx.reply('⛔️ شما دسترسی ادمین ندارید.');
            return;
        }

        // بررسی نقش
        if (allowedRoles && allowedRoles.length > 0) {
            // SUPER_ADMIN همیشه دسترسی دارد
            if (admin.role !== 'SUPER_ADMIN' && !allowedRoles.includes(admin.role)) {
                await ctx.reply('⛔️ شما دسترسی به این بخش را ندارید.');
                return;
            }
        }

        // ذخیره اطلاعات ادمین در context برای استفاده در handler
        (ctx as any).adminRole = admin.role;
        (ctx as any).adminId = admin.id;

        await next();
    };
}
```

### مرحله 2: اعمال نقش‌ها در index.ts

**فایل:** `src/index.ts`

```typescript
// فقط SUPER_ADMIN و ADMIN
bot.callbackQuery('admin:panels', adminAuthMiddleware(['SUPER_ADMIN', 'ADMIN']), 
    PanelManagementHandler.handlePanelsMenu);

// SUPER_ADMIN, ADMIN, SALES
bot.callbackQuery('admin:products', adminAuthMiddleware(['SUPER_ADMIN', 'ADMIN', 'SALES']), 
    ProductManagementHandler.handleProductsMenu);

// همه ادمین‌ها
bot.callbackQuery('admin:stats', adminAuthMiddleware(), 
    StatisticsHandler.handleStatsMenu);

// فقط SUPER_ADMIN
bot.callbackQuery('admin:admins', adminAuthMiddleware(['SUPER_ADMIN']), 
    AdminManagementHandler.handleAdminsMenu);

// SUPPORT و بالاتر
bot.callbackQuery('admin:tickets', adminAuthMiddleware(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']),
    SupportHandler.handleTicketsMenu);
```

### مرحله 3: ایجاد Handler مدیریت ادمین‌ها

**فایل جدید:** `src/presentation/handlers/admin/AdminRoleManagementHandler.ts`

```typescript
import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { AdminRole } from '@prisma/client';
import { logger } from '../../../shared/logger';

export class AdminRoleManagementHandler {
    // نمایش لیست ادمین‌ها
    static async handleAdminsMenu(ctx: Context): Promise<void> {
        const admins = await prisma.admin.findMany({
            orderBy: { createdAt: 'desc' },
        });

        let message = '👑 <b>مدیریت ادمین‌ها</b>\n\n';
        
        const roleLabels: Record<AdminRole, string> = {
            SUPER_ADMIN: '👑 مدیر ارشد',
            ADMIN: '🔧 مدیر',
            SALES: '💰 فروش',
            SUPPORT: '🎧 پشتیبانی',
        };

        for (const admin of admins) {
            message += `${roleLabels[admin.role]} | Chat ID: <code>${admin.chatId}</code>\n`;
        }

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ افزودن ادمین', callback_data: 'admin:admins:add' }],
                    [{ text: '✏️ تغییر نقش', callback_data: 'admin:admins:edit_role' }],
                    [{ text: '🗑 حذف ادمین', callback_data: 'admin:admins:remove' }],
                    [{ text: '🔙 بازگشت', callback_data: 'admin:menu' }],
                ],
            },
        });
    }

    // افزودن ادمین جدید
    static async handleAddAdmin(ctx: Context): Promise<void> {
        await ctx.editMessageText(
            '👤 <b>افزودن ادمین جدید</b>\n\n' +
            'لطفاً Chat ID کاربر مورد نظر را ارسال کنید:',
            { parse_mode: 'HTML' }
        );
        // ست کردن step کاربر ادمین برای دریافت chatId
        // await setAdminStep(ctx.from.id, 'awaiting_admin_chat_id');
    }

    // تغییر نقش ادمین
    static async handleEditRole(ctx: Context, adminChatId: bigint, newRole: AdminRole): Promise<void> {
        await prisma.admin.update({
            where: { chatId: adminChatId },
            data: { role: newRole },
        });
        
        await ctx.answerCallbackQuery({ text: `✅ نقش تغییر یافت به ${newRole}` });
    }

    // حذف ادمین
    static async handleRemoveAdmin(ctx: Context, adminChatId: bigint): Promise<void> {
        await prisma.admin.delete({
            where: { chatId: adminChatId },
        });
        
        await ctx.answerCallbackQuery({ text: '✅ ادمین حذف شد' });
    }
}
```

### مرحله 4: ماتریس دسترسی

```typescript
// src/shared/permissions.ts

import { AdminRole } from '@prisma/client';

export const PERMISSION_MATRIX: Record<string, AdminRole[]> = {
    // مدیریت پنل‌ها
    'admin:panels':          ['SUPER_ADMIN', 'ADMIN'],
    'admin:add_panel':       ['SUPER_ADMIN', 'ADMIN'],
    'admin:delete_panel':    ['SUPER_ADMIN'],
    
    // مدیریت محصولات
    'admin:products':        ['SUPER_ADMIN', 'ADMIN', 'SALES'],
    'admin:add_product':     ['SUPER_ADMIN', 'ADMIN'],
    'admin:delete_product':  ['SUPER_ADMIN'],
    
    // مدیریت کاربران
    'admin:users':           ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'admin:block_user':      ['SUPER_ADMIN', 'ADMIN'],
    'admin:charge_user':     ['SUPER_ADMIN', 'ADMIN', 'SALES'],
    
    // مدیریت ادمین‌ها
    'admin:admins':          ['SUPER_ADMIN'],
    
    // پرداخت‌ها
    'admin:payments':        ['SUPER_ADMIN', 'ADMIN', 'SALES'],
    
    // تیکت‌ها
    'admin:tickets':         ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    
    // Broadcast
    'admin:broadcast':       ['SUPER_ADMIN', 'ADMIN'],
    
    // تنظیمات
    'admin:settings':        ['SUPER_ADMIN'],
    
    // آمار
    'admin:stats':           ['SUPER_ADMIN', 'ADMIN', 'SALES'],
};
```

---

## 📝 تست‌ها

1. ایجاد ادمین با نقش `SUPPORT` → نباید به پنل‌ها دسترسی داشته باشد
2. ایجاد ادمین با نقش `SALES` → باید به محصولات و پرداخت‌ها دسترسی داشته باشد
3. تغییر نقش ادمین → باید دسترسی‌ها فوراً تغییر کند
4. `SUPER_ADMIN` → باید به همه بخش‌ها دسترسی داشته باشد
5. حذف ادمین → باید دسترسی کاملاً قطع شود
