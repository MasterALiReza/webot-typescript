# 🧾 Feature 02: View and Manage All Users (مشاهده و مدیریت همه کاربران)

## 📋 شرح فیچر

سیستم جامع مدیریت کاربران شامل مشاهده لیست کامل، فیلتر، صفحه‌بندی، جستجو، و عملیات مدیریتی بر روی کاربران.

---

## 📊 وضعیت فعلی

### ✅ موجود:
- `UserManagementHandler` با قابلیت مشاهده پروفایل، بن/آنبن، لیست اخیر، مسدودشده‌ها
- `UserRepository` با متدهای findByChatId, findAll, countAll, countBlocked
- سیستم جستجو بر اساس chatId

### ❌ کمبود:
- **صفحه‌بندی** (Pagination) در لیست کاربران ندارد
- **فیلتر** بر اساس وضعیت، تاریخ عضویت، موجودی
- **Export** لیست کاربران (CSV/Excel)
- **جستجو** بر اساس نام کاربری، شماره تلفن
- **عملیات گروهی** (Block/Unblock/Message دسته‌ای)

---

## 🛠️ راهنمای پیاده‌سازی

### مرحله 1: گسترش UserRepository

**فایل:** `src/infrastructure/database/repositories/UserRepository.ts`

```typescript
// متدهای جدید برای اضافه شدن:

// صفحه‌بندی کاربران
async findPaginated(page: number, perPage: number = 20, filters?: UserFilters): Promise<{
    users: User[];
    total: number;
    totalPages: number;
}> {
    const where: Prisma.UserWhereInput = {};
    
    if (filters?.status) where.userStatus = filters.status;
    if (filters?.hasBalance) where.balance = { gt: 0 };
    if (filters?.searchQuery) {
        where.OR = [
            { username: { contains: filters.searchQuery } },
            { firstName: { contains: filters.searchQuery } },
            { phoneNumber: { contains: filters.searchQuery } },
            { chatId: isNaN(Number(filters.searchQuery)) ? undefined : BigInt(filters.searchQuery) },
        ].filter(Boolean);
    }
    if (filters?.createdAfter) where.createdAt = { gte: filters.createdAfter };

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
    ]);

    return { users, total, totalPages: Math.ceil(total / perPage) };
}

// جستجوی چندگانه
async search(query: string): Promise<User[]> {
    return prisma.user.findMany({
        where: {
            OR: [
                { username: { contains: query } },
                { firstName: { contains: query } },
                { phoneNumber: { contains: query } },
            ],
        },
        take: 20,
    });
}

// آمار کاربران
async getStatistics(): Promise<UserStatistics> {
    const [total, active, blocked, withBalance, todayNew] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { userStatus: 'ACTIVE' } }),
        prisma.user.count({ where: { userStatus: 'BLOCKED' } }),
        prisma.user.count({ where: { balance: { gt: 0 } } }),
        prisma.user.count({ where: { createdAt: { gte: startOfDay() } } }),
    ]);
    return { total, active, blocked, withBalance, todayNew };
}
```

### مرحله 2: آپدیت UserManagementHandler

**فایل:** `src/presentation/handlers/admin/UserManagementHandler.ts`

```typescript
// لیست با صفحه‌بندی
static async handleListUsers(ctx: Context, page: number = 1): Promise<void> {
    const { users, total, totalPages } = await userRepo.findPaginated(page, 10);

    let message = `👥 <b>کاربران (صفحه ${page} از ${totalPages})</b>\n`;
    message += `📊 کل: ${total} کاربر\n\n`;

    for (const user of users) {
        const statusEmoji = user.userStatus === 'ACTIVE' ? '✅' : '⛔️';
        message += `${statusEmoji} ${user.firstName || 'بدون‌نام'} | `;
        message += `<code>${user.chatId}</code> | `;
        message += `💰 ${user.balance}\n`;
    }

    const buttons = [];
    if (page > 1) buttons.push({ text: '⬅️ قبلی', callback_data: `admin:users:page:${page - 1}` });
    if (page < totalPages) buttons.push({ text: '➡️ بعدی', callback_data: `admin:users:page:${page + 1}` });

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                buttons,
                [{ text: '🔍 جستجو', callback_data: 'admin:users:search' }],
                [{ text: '📥 خروجی CSV', callback_data: 'admin:users:export' }],
                [{ text: '🔙 بازگشت', callback_data: 'admin:panel' }],
            ],
        },
    });
}

// جستجوی کاربر
static async handleSearchUser(ctx: Context, query: string): Promise<void> {
    const users = await userRepo.search(query);
    // نمایش لیست نتایج با inline keyboard
}

// عملیات گروهی
static async handleBulkAction(ctx: Context, action: 'block' | 'unblock' | 'message', userIds: number[]): Promise<void> {
    // اعمال عملیات بر روی لیست کاربران
}

// Export CSV
static async handleExportUsers(ctx: Context): Promise<void> {
    const users = await prisma.user.findMany();
    // تبدیل به CSV و ارسال فایل
}
```

### مرحله 3: ثبت callback در index.ts

```typescript
// صفحه‌بندی
bot.callbackQuery(/^admin:users:page:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await UserManagementHandler.handleListUsers(ctx, page);
});

// جستجو
bot.callbackQuery('admin:users:search', adminAuthMiddleware(), async (ctx) => {
    await UserManagementHandler.handleSearchPrompt(ctx);
});

// export
bot.callbackQuery('admin:users:export', adminAuthMiddleware(['SUPER_ADMIN', 'ADMIN']), async (ctx) => {
    await UserManagementHandler.handleExportUsers(ctx);
});
```

---

## 📝 تست‌ها
1. لیست کاربران با 100+ کاربر → صفحه‌بندی صحیح
2. جستجو بر اساس نام، chatId، شماره تلفن
3. فیلتر کاربران فقط ACTIVE یا BLOCKED
4. Export CSV با تمام فیلدها
5. عملیات گروهی بر 10+ کاربر همزمان
