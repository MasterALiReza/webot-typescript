# 🔒 Feature 20: Config Creation Limit (محدودیت ساخت کانفیگ)

## 📋 شرح فیچر
محدود کردن تعداد کانفیگ‌های قابل ساخت برای هر کاربر/محصول.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده
- `BotSetting.testAccountLimit` فقط برای تست است
- محدودیت ساخت کانفیگ واقعی ندارد

## 🛠️ پیاده‌سازی

### Schema
```prisma
// Product:
  maxConfigs    Int  @default(1) @map("max_configs") // حداکثر کانفیگ هر خرید
  
// BotSetting:
  globalMaxConfigs  Int  @default(3) @map("global_max_configs") // سقف کلی هر کاربر
```

### Validation
```typescript
async canCreateConfig(userId: number, productId: number): Promise<boolean> {
    const settings = await prisma.botSetting.findFirst();
    const product = await prisma.product.findUnique({ where: { id: productId } });
    
    // شمارش کانفیگ‌های فعال کاربر
    const activeConfigs = await prisma.invoice.count({
        where: { userId, status: 'ACTIVE' },
    });
    
    if (activeConfigs >= settings!.globalMaxConfigs) return false;
    
    // شمارش کانفیگ‌های همین محصول
    const productConfigs = await prisma.invoice.count({
        where: { userId, productId, status: 'ACTIVE' },
    });
    
    return productConfigs < product!.maxConfigs;
}
```

---

# 🌐 Feature 21: Web Panel Integration (یکپارچگی وب پنل)

## 📋 شرح فیچر
ارائه یک وب پنل مدیریتی همراه ربات تلگرام برای مدیریت آسان‌تر.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده

## 🛠️ پیاده‌سازی

### معماری پیشنهادی
```
src/
├── web/
│   ├── server.ts          # Express server
│   ├── routes/
│   │   ├── auth.ts        # JWT auth
│   │   ├── users.ts       # /api/users
│   │   ├── products.ts    # /api/products
│   │   ├── invoices.ts    # /api/invoices
│   │   ├── panels.ts      # /api/panels
│   │   └── stats.ts       # /api/stats
│   ├── middlewares/
│   │   └── authMiddleware.ts
│   └── public/            # Static frontend
```

### Express Server
```typescript
// src/web/server.ts
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// Auth
app.post('/api/auth/login', async (req, res) => {
    const { chatId, token } = req.body;
    const admin = await prisma.admin.findUnique({ where: { chatId: BigInt(chatId) } });
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });
    const jwtToken = jwt.sign({ adminId: admin.id, role: admin.role }, process.env.JWT_SECRET!);
    res.json({ token: jwtToken });
});

// CRUD endpoints
app.get('/api/users', authMiddleware, async (req, res) => {
    const { page, perPage, search } = req.query;
    const result = await userRepo.findPaginated(Number(page) || 1, Number(perPage) || 20);
    res.json(result);
});

app.listen(3001, () => console.log('Web panel on http://localhost:3001'));
```

---

# 📍 Feature 22: Change Service Location (تغییر لوکیشن سرویس)

## 📋 شرح فیچر
امکان تغییر لوکیشن (سرور) سرویس VPN بدون نیاز به خرید جدید.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده

## 🛠️ پیاده‌سازی

### Schema
```prisma
// Panel:
  location      String?  @db.VarChar(100) // کشور/شهر
  locationFlag  String?  @map("location_flag") @db.VarChar(10) // 🇩🇪 emoji
```

### Handler
```typescript
export class LocationChangeHandler {
    static async showLocations(ctx: Context, invoiceId: number) {
        const invoice = await invoiceRepo.findById(invoiceId);
        const currentPanel = await panelRepo.findById(invoice.panelId);
        
        // پنل‌های با همان نوع ولی لوکیشن متفاوت
        const panels = await prisma.panel.findMany({
            where: { type: currentPanel.type, status: 'ACTIVE', id: { not: currentPanel.id } },
        });
        
        let msg = `📍 <b>تغییر لوکیشن</b>\n\nلوکیشن فعلی: ${currentPanel.locationFlag} ${currentPanel.location}\n`;
        const kb = new InlineKeyboard();
        for (const p of panels) {
            kb.text(`${p.locationFlag} ${p.location}`, `change_loc:${invoiceId}:${p.id}`).row();
        }
    }
    
    static async changeLocation(ctx: Context, invoiceId: number, newPanelId: number) {
        const invoice = await invoiceRepo.findById(invoiceId);
        const oldPanel = await panelRepo.findById(invoice.panelId);
        const newPanel = await panelRepo.findById(newPanelId);
        
        // 1. گرفتن اطلاعات از پنل قدیم
        const oldAdapter = PanelFactory.create(oldPanel);
        await oldAdapter.authenticate();
        const userInfo = await oldAdapter.getUser(invoice.username);
        
        // 2. حذف از پنل قدیم
        await oldAdapter.removeUser(invoice.username);
        
        // 3. ساخت در پنل جدید
        const newAdapter = PanelFactory.create(newPanel);
        await newAdapter.authenticate();
        await newAdapter.createUser({
            username: invoice.username,
            volume: bytesToGB(userInfo.dataLimit - userInfo.usedTraffic),
            duration: remainingDays(userInfo.expire),
        });
        
        // 4. آپدیت invoice
        await invoiceRepo.update(invoiceId, { panelId: newPanelId });
        
        await ctx.editMessageText(`✅ لوکیشن تغییر کرد به ${newPanel.locationFlag} ${newPanel.location}`);
    }
}
```

---

# 🔄 Feature 23: Transfer Services Between Users (انتقال سرویس)

## 📋 شرح فیچر
انتقال سرویس VPN از یک کاربر به کاربر دیگر.

## 📊 وضعیت فعلی: ❌ پیاده‌سازی نشده

## 🛠️ پیاده‌سازی

```typescript
export class TransferHandler {
    static async handleTransfer(ctx: Context, invoiceId: number, targetChatId: bigint) {
        const invoice = await invoiceRepo.findById(invoiceId);
        const targetUser = await userRepo.findByChatId(targetChatId);
        if (!targetUser) return ctx.reply('❌ کاربر مقصد یافت نشد');
        
        // آپدیت مالکیت
        await invoiceRepo.update(invoiceId, { userId: targetUser.id });
        
        // اطلاع‌رسانی
        await bot.api.sendMessage(Number(targetChatId), 
            `🔄 سرویس ${invoice.username} به شما منتقل شد!`);
        await ctx.reply('✅ انتقال با موفقیت انجام شد.');
    }
}
```

---

# 💱 Feature 24: Rial Exchange Gateway (درگاه ارزی ریال)

## 📋 شرح فیچر
درگاه پرداخت ارزی با تبدیل خودکار نرخ ارز.

## 📊 وضعیت فعلی: ⚠️ جزئی
### ✅ موجود:
- ZarinpalGateway, AqayePardakhtGateway (ریالی)
- NowPaymentsGateway (ارزی)
- PerfectMoneyGateway (ارزی)

### ❌ کمبود:
- تبدیل خودکار نرخ ارز ندارد
- نمایش قیمت به هر دو ارز ندارد
- API نرخ لحظه‌ای

## 🛠️ پیاده‌سازی

### Schema
```prisma
// BotSetting:
  exchangeRate        Decimal? @map("exchange_rate") @db.Decimal(12, 0)
  autoExchangeRate    Boolean  @default(false) @map("auto_exchange_rate")
  exchangeRateSource  String?  @map("exchange_rate_source") @db.VarChar(255)
```

### Service نرخ ارز
```typescript
// src/infrastructure/services/ExchangeRateService.ts
export class ExchangeRateService {
    static async getUSDRate(): Promise<number> {
        const settings = await prisma.botSetting.findFirst();
        
        if (!settings?.autoExchangeRate && settings?.exchangeRate) {
            return Number(settings.exchangeRate);
        }
        
        // API نرخ لحظه‌ای
        const response = await fetch('https://api.navasan.tech/latest/?api_key=KEY&item=usd');
        const data = await response.json();
        return data.usd.value;
    }
    
    static convertToUSD(rialAmount: number, rate: number): number {
        return Math.ceil(rialAmount / rate * 100) / 100;
    }
    
    static convertToRial(usdAmount: number, rate: number): number {
        return Math.round(usdAmount * rate);
    }
}
```

### اتصال به PurchaseHandler
```typescript
// نمایش قیمت دوگانه
const rate = await ExchangeRateService.getUSDRate();
const priceRial = Number(product.price);
const priceUSD = ExchangeRateService.convertToUSD(priceRial, rate);

let msg = `💰 قیمت: ${priceRial.toLocaleString()} تومان\n`;
msg += `💵 معادل: $${priceUSD}\n`;
msg += `📈 نرخ ارز: ${rate.toLocaleString()} تومان\n`;
```
