# مثال‌های عملی - کد کامل

## 1. پروژه ساده شده (Simplified Version)

این یک نسخه ساده‌تر برای شروع سریع است.

### Structure

```
bot-mirza-simple/
├── src/
│   ├── bot/
│   │   ├── handlers/
│   │   │   ├── start.handler.ts
│   │   │   ├── purchase.handler.ts
│   │   │   └── wallet.handler.ts
│   │   ├── keyboards/
│   │   │   └── main.keyboard.ts
│   │   └── index.ts
│   ├── database/
│   │   ├── prisma.ts
│   │   └── schema.prisma
│   ├── services/
│   │   ├── marzban.service.ts
│   │   ├── payment.service.ts
│   │   └── user.service.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── .env
├── package.json
└── tsconfig.json
```

### کد کامل

**package.json:**
```json
{
  "name": "bot-mirza-simple",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "grammy": "^1.19.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.0.0",
    "prisma": "^5.0.0"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**.env:**
```env
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL="mysql://root:password@localhost:3306/bot_mirza"

# Marzban
MARZBAN_URL=https://your-panel.com
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=admin123
```

**prisma/schema.prisma:**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id          Int      @id @default(autoincrement())
  chatId      BigInt   @unique
  username    String?
  firstName   String?
  phone       String?
  balance     Int      @default(0)
  verified    Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  purchases   Purchase[]
  
  @@map("users")
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Int
  volume      Int      // GB
  days        Int
  active      Boolean  @default(true)
  
  purchases   Purchase[]
  
  @@map("products")
}

model Purchase {
  id          Int      @id @default(autoincrement())
  userId      Int
  productId   Int
  username    String
  configUrl   String   @db.Text
  expiresAt   DateTime
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id])
  product     Product  @relation(fields: [productId], references: [id])
  
  @@map("purchases")
}
```

**src/database/prisma.ts:**
```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});
```

**src/types/index.ts:**
```typescript
export interface MarzbanUser {
  username: string;
  subscription_url: string;
  expire: number;
}

export interface CreateConfigInput {
  volume: number;  // در GB
  days: number;
}

export interface CreateConfigOutput {
  username: string;
  url: string;
  expiresAt: Date;
}
```

**src/services/marzban.service.ts:**
```typescript
import axios, { AxiosInstance } from 'axios';
import { CreateConfigInput, CreateConfigOutput } from '../types';

export class MarzbanService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(
    private url: string,
    private username: string,
    private password: string
  ) {
    this.client = axios.create({
      baseURL: url,
      timeout: 10000,
    });
  }

  // Login و گرفتن token
  private async authenticate(): Promise<string> {
    if (this.token) return this.token;

    try {
      const response = await this.client.post('/api/admin/token', {
        username: this.username,
        password: this.password,
      });

      this.token = response.data.access_token;
      return this.token;
    } catch (error) {
      console.error('Marzban auth error:', error);
      throw new Error('Failed to authenticate with Marzban');
    }
  }

  // ساخت کانفیگ جدید
  async createConfig(input: CreateConfigInput): Promise<CreateConfigOutput> {
    const token = await this.authenticate();

    // تولید username یونیک
    const username = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // محاسبه تاریخ انقضا
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.days);

    try {
      const response = await this.client.post(
        '/api/user',
        {
          username,
          data_limit: input.volume * 1024 * 1024 * 1024, // GB to bytes
          expire: Math.floor(expiresAt.getTime() / 1000), // timestamp
          proxies: {
            vmess: {},
            vless: {},
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        username: response.data.username,
        url: response.data.subscription_url,
        expiresAt,
      };
    } catch (error) {
      console.error('Create config error:', error);
      throw new Error('Failed to create config');
    }
  }

  // دریافت اطلاعات کاربر
  async getUser(username: string) {
    const token = await this.authenticate();

    try {
      const response = await this.client.get(`/api/user/${username}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  // حذف کاربر
  async deleteUser(username: string): Promise<boolean> {
    const token = await this.authenticate();

    try {
      await this.client.delete(`/api/user/${username}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return true;
    } catch (error) {
      console.error('Delete user error:', error);
      return false;
    }
  }
}
```

**src/services/user.service.ts:**
```typescript
import { prisma } from '../database/prisma';

export class UserService {
  // پیدا کردن یا ساخت کاربر
  async findOrCreate(chatId: number, userData: any) {
    let user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          chatId: BigInt(chatId),
          username: userData.username,
          firstName: userData.first_name,
        },
      });
    }

    return user;
  }

  // افزایش موجودی
  async addBalance(chatId: number, amount: number) {
    return prisma.user.update({
      where: { chatId: BigInt(chatId) },
      data: {
        balance: {
          increment: amount,
        },
      },
    });
  }

  // کم کردن موجودی
  async deductBalance(chatId: number, amount: number) {
    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(chatId) },
    });

    if (!user || user.balance < amount) {
      throw new Error('موجودی کافی نیست');
    }

    return prisma.user.update({
      where: { chatId: BigInt(chatId) },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });
  }

  // تایید شماره
  async verifyPhone(chatId: number, phone: string) {
    return prisma.user.update({
      where: { chatId: BigInt(chatId) },
      data: {
        phone,
        verified: true,
      },
    });
  }
}
```

**src/bot/keyboards/main.keyboard.ts:**
```typescript
import { Keyboard } from 'grammy';

export function getMainKeyboard(verified: boolean) {
  const keyboard = new Keyboard();

  if (!verified) {
    keyboard.requestContact('✅ تایید شماره').row();
    keyboard.text('❓ راهنما').row();
  } else {
    keyboard.text('🛒 خرید سرویس').text('📦 سرویس‌های من').row();
    keyboard.text('💰 کیف پول').text('❓ راهنما').row();
    keyboard.text('👤 پروفایل').text('🎫 پشتیبانی').row();
  }

  return keyboard.resized();
}
```

**src/bot/handlers/start.handler.ts:**
```typescript
import { Context } from 'grammy';
import { UserService } from '../../services/user.service';
import { getMainKeyboard } from '../keyboards/main.keyboard';

export class StartHandler {
  constructor(private userService: UserService) {}

  async handle(ctx: Context) {
    if (!ctx.from) return;

    const user = await this.userService.findOrCreate(ctx.from.id, ctx.from);

    const message = `سلام ${user.firstName}! 👋

به ربات فروش VPN خوش آمدید.

${!user.verified ? '⚠️ لطفا ابتدا شماره خود را تایید کنید.' : ''}`;

    await ctx.reply(message, {
      reply_markup: getMainKeyboard(user.verified),
    });
  }
}
```

**src/bot/handlers/purchase.handler.ts:**
```typescript
import { Context, InlineKeyboard } from 'grammy';
import { prisma } from '../../database/prisma';
import { UserService } from '../../services/user.service';
import { MarzbanService } from '../../services/marzban.service';

export class PurchaseHandler {
  constructor(
    private userService: UserService,
    private marzbanService: MarzbanService
  ) {}

  // نمایش لیست محصولات
  async showProducts(ctx: Context) {
    const products = await prisma.product.findMany({
      where: { active: true },
    });

    if (products.length === 0) {
      await ctx.reply('محصولی موجود نیست');
      return;
    }

    const keyboard = new InlineKeyboard();

    products.forEach((product) => {
      keyboard.text(
        `${product.name} - ${product.price.toLocaleString('fa-IR')} تومان`,
        `buy_${product.id}`
      );
      keyboard.row();
    });

    await ctx.reply('محصول مورد نظر را انتخاب کنید:', {
      reply_markup: keyboard,
    });
  }

  // نمایش جزئیات محصول
  async showProductDetails(ctx: Context, productId: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      await ctx.answerCallbackQuery({ text: 'محصول یافت نشد' });
      return;
    }

    const keyboard = new InlineKeyboard();
    keyboard.text('✅ تایید خرید', `confirm_${productId}`);
    keyboard.text('❌ انصراف', 'cancel');

    const message = `📦 ${product.name}

💰 قیمت: ${product.price.toLocaleString('fa-IR')} تومان
📊 حجم: ${product.volume} گیگابایت
⏰ مدت: ${product.days} روز`;

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
    });
  }

  // انجام خرید
  async executePurchase(ctx: Context, productId: number) {
    if (!ctx.from) return;

    await ctx.answerCallbackQuery({ text: 'در حال پردازش...' });

    try {
      // دریافت اطلاعات محصول
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        await ctx.reply('❌ محصول یافت نشد');
        return;
      }

      // کسر موجودی
      const user = await this.userService.deductBalance(
        ctx.from.id,
        product.price
      );

      // ساخت کانفیگ
      const config = await this.marzbanService.createConfig({
        volume: product.volume,
        days: product.days,
      });

      // ذخیره خرید
      await prisma.purchase.create({
        data: {
          userId: user.id,
          productId: product.id,
          username: config.username,
          configUrl: config.url,
          expiresAt: config.expiresAt,
        },
      });

      // ارسال پیام موفقیت
      const message = `✅ خرید با موفقیت انجام شد

🔗 لینک کانفیگ شما:
\`${config.url}\`

📅 تاریخ انقضا: ${config.expiresAt.toLocaleDateString('fa-IR')}
💰 موجودی باقیمانده: ${user.balance.toLocaleString('fa-IR')} تومان`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
      });
    } catch (error: any) {
      console.error('Purchase error:', error);
      await ctx.reply(`❌ خطا: ${error.message}`);
    }
  }

  // نمایش خریدهای کاربر
  async showMyPurchases(ctx: Context) {
    if (!ctx.from) return;

    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(ctx.from.id) },
      include: {
        purchases: {
          where: { active: true },
          include: { product: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user || user.purchases.length === 0) {
      await ctx.reply('شما هیچ سرویسی ندارید');
      return;
    }

    let message = '📦 سرویس‌های شما:\n\n';

    user.purchases.forEach((purchase, index) => {
      const isExpired = new Date() > purchase.expiresAt;
      const status = isExpired ? '❌ منقضی' : '✅ فعال';

      message += `${index + 1}. ${purchase.product.name}\n`;
      message += `وضعیت: ${status}\n`;
      message += `تاریخ انقضا: ${purchase.expiresAt.toLocaleDateString('fa-IR')}\n`;
      message += `لینک: \`${purchase.configUrl}\`\n\n`;
    });

    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
  }
}
```

**src/bot/handlers/wallet.handler.ts:**
```typescript
import { Context, InlineKeyboard } from 'grammy';
import { prisma } from '../../database/prisma';

export class WalletHandler {
  async showWallet(ctx: Context) {
    if (!ctx.from) return;

    const user = await prisma.user.findUnique({
      where: { chatId: BigInt(ctx.from.id) },
    });

    if (!user) return;

    const keyboard = new InlineKeyboard();
    keyboard.text('➕ افزایش موجودی', 'charge_wallet');

    const message = `💰 کیف پول شما

موجودی فعلی: ${user.balance.toLocaleString('fa-IR')} تومان`;

    await ctx.reply(message, {
      reply_markup: keyboard,
    });
  }

  async showChargeOptions(ctx: Context) {
    const keyboard = new InlineKeyboard();

    const amounts = [10000, 20000, 50000, 100000];

    amounts.forEach((amount) => {
      keyboard.text(
        `${amount.toLocaleString('fa-IR')} تومان`,
        `charge_${amount}`
      );
      keyboard.row();
    });

    await ctx.editMessageText('مبلغ مورد نظر را انتخاب کنید:', {
      reply_markup: keyboard,
    });
  }

  async processCharge(ctx: Context, amount: number) {
    // اینجا باید درگاه پرداخت وصل بشه
    // فعلا فقط یک پیام می‌فرستیم

    await ctx.answerCallbackQuery({ text: 'در حال انتقال به درگاه...' });

    const message = `لطفا مبلغ ${amount.toLocaleString('fa-IR')} تومان را به شماره کارت زیر واریز کنید:

6037-9977-XXXX-XXXX

سپس عکس رسید را ارسال کنید.`;

    await ctx.reply(message);
  }
}
```

**src/bot/index.ts:**
```typescript
import { Bot } from 'grammy';
import { StartHandler } from './handlers/start.handler';
import { PurchaseHandler } from './handlers/purchase.handler';
import { WalletHandler } from './handlers/wallet.handler';
import { UserService } from '../services/user.service';
import { MarzbanService } from '../services/marzban.service';

export class TelegramBot {
  private bot: Bot;
  private startHandler: StartHandler;
  private purchaseHandler: PurchaseHandler;
  private walletHandler: WalletHandler;

  constructor(token: string, marzbanService: MarzbanService) {
    this.bot = new Bot(token);

    const userService = new UserService();

    this.startHandler = new StartHandler(userService);
    this.purchaseHandler = new PurchaseHandler(userService, marzbanService);
    this.walletHandler = new WalletHandler();

    this.setupHandlers();
  }

  private setupHandlers() {
    // Commands
    this.bot.command('start', (ctx) => this.startHandler.handle(ctx));

    // Contact verification
    this.bot.on('message:contact', async (ctx) => {
      const userService = new UserService();
      await userService.verifyPhone(
        ctx.from.id,
        ctx.message.contact.phone_number
      );
      await ctx.reply('✅ شماره شما با موفقیت تایید شد');
      await this.startHandler.handle(ctx);
    });

    // Text messages
    this.bot.hears('🛒 خرید سرویس', (ctx) =>
      this.purchaseHandler.showProducts(ctx)
    );

    this.bot.hears('📦 سرویس‌های من', (ctx) =>
      this.purchaseHandler.showMyPurchases(ctx)
    );

    this.bot.hears('💰 کیف پول', (ctx) => this.walletHandler.showWallet(ctx));

    // Callback queries
    this.bot.callbackQuery(/^buy_(\d+)$/, async (ctx) => {
      const productId = parseInt(ctx.match[1]);
      await this.purchaseHandler.showProductDetails(ctx, productId);
    });

    this.bot.callbackQuery(/^confirm_(\d+)$/, async (ctx) => {
      const productId = parseInt(ctx.match[1]);
      await this.purchaseHandler.executePurchase(ctx, productId);
    });

    this.bot.callbackQuery('charge_wallet', (ctx) =>
      this.walletHandler.showChargeOptions(ctx)
    );

    this.bot.callbackQuery(/^charge_(\d+)$/, async (ctx) => {
      const amount = parseInt(ctx.match[1]);
      await this.walletHandler.processCharge(ctx, amount);
    });

    this.bot.callbackQuery('cancel', async (ctx) => {
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery({ text: 'لغو شد' });
    });

    // Error handling
    this.bot.catch((err) => {
      console.error('Bot error:', err);
    });
  }

  start() {
    this.bot.start();
    console.log('✅ Bot started successfully');
  }

  stop() {
    this.bot.stop();
  }
}
```

**src/index.ts:**
```typescript
import 'dotenv/config';
import { TelegramBot } from './bot';
import { MarzbanService } from './services/marzban.service';
import { prisma } from './database/prisma';

async function main() {
  // Check environment variables
  if (!process.env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is required');
  }

  // Initialize Marzban service
  const marzbanService = new MarzbanService(
    process.env.MARZBAN_URL!,
    process.env.MARZBAN_USERNAME!,
    process.env.MARZBAN_PASSWORD!
  );

  // Initialize bot
  const bot = new TelegramBot(process.env.BOT_TOKEN, marzbanService);

  // Graceful shutdown
  process.once('SIGINT', () => {
    console.log('\n🛑 Stopping bot...');
    bot.stop();
    prisma.$disconnect();
    process.exit(0);
  });

  process.once('SIGTERM', () => {
    console.log('\n🛑 Stopping bot...');
    bot.stop();
    prisma.$disconnect();
    process.exit(0);
  });

  // Start bot
  bot.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

## نحوه اجرا

```bash
# 1. Clone repository
git clone [your-repo]
cd bot-mirza-simple

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your values

# 4. Setup database
npx prisma db push
npx prisma db seed  # اگر seed داری

# 5. Run in development
npm run dev

# 6. Build for production
npm run build
npm start
```

---

## افزودن محصول دستی

```sql
INSERT INTO products (name, price, volume, days, active)
VALUES 
  ('پکیج مبتدی', 30000, 30, 30, 1),
  ('پکیج حرفه‌ای', 50000, 50, 30, 1),
  ('پکیج VIP', 100000, 100, 30, 1);
```

---

این یک نسخه ساده و قابل فهم است که می‌تونی باهاش شروع کنی.

---

## نمونه‌های تکمیلی (قابلیت‌های کامل ربات اصلی)

### Multi-Panel Adapter Pattern

```typescript
// src/core/interfaces/IPanelAdapter.ts
export interface CreateUserInput {
  username: string;
  volume: number;    // GB
  duration: number;  // days
  inbounds?: string;
}

export interface PanelUserInfo {
  username: string;
  status: 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold';
  usedTraffic: number;
  dataLimit: number;
  expire: number;
  subscriptionUrl?: string;
}

export interface IPanelAdapter {
  authenticate(): Promise<void>;
  createUser(input: CreateUserInput): Promise<PanelUserInfo>;
  getUser(username: string): Promise<PanelUserInfo | null>;
  removeUser(username: string): Promise<void>;
  modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void>;
  revokeSubscription(username: string): Promise<string>;
  resetDataUsage(username: string): Promise<void>;
}
```

```typescript
// src/infrastructure/panels/MarzbanAdapter.ts
import axios from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';

export class MarzbanAdapter implements IPanelAdapter {
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(private config: { url: string; username: string; password: string; inbounds?: string }) {}

  async authenticate(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiry) return;
    const form = new URLSearchParams({ username: this.config.username, password: this.config.password });
    const res = await axios.post(`${this.config.url}/api/admin/token`, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    this.token = res.data.access_token;
    this.tokenExpiry = Date.now() + 50 * 60 * 1000;
  }

  async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
    await this.authenticate();
    const expire = Math.floor(Date.now() / 1000) + input.duration * 86400;
    const res = await axios.post(`${this.config.url}/api/user`, {
      username: input.username,
      data_limit: input.volume * 1024 ** 3,
      expire,
      status: 'active',
      proxies: { vmess: {}, vless: {} },
      inbounds: input.inbounds ? JSON.parse(input.inbounds) : undefined,
    }, { headers: { Authorization: `Bearer ${this.token}` } });

    return {
      username: res.data.username,
      status: res.data.status,
      usedTraffic: res.data.used_traffic,
      dataLimit: res.data.data_limit,
      expire: res.data.expire,
      subscriptionUrl: res.data.subscription_url,
    };
  }

  async getUser(username: string): Promise<PanelUserInfo | null> {
    await this.authenticate();
    try {
      const res = await axios.get(`${this.config.url}/api/user/${username}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return {
        username: res.data.username,
        status: res.data.status,
        usedTraffic: res.data.used_traffic,
        dataLimit: res.data.data_limit,
        expire: res.data.expire,
        subscriptionUrl: res.data.subscription_url,
      };
    } catch { return null; }
  }

  async removeUser(username: string): Promise<void> {
    await this.authenticate();
    await axios.delete(`${this.config.url}/api/user/${username}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }

  async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
    await this.authenticate();
    const body: any = {};
    if (data.volume) body.data_limit = data.volume * 1024 ** 3;
    if (data.duration) body.expire = Math.floor(Date.now() / 1000) + data.duration * 86400;
    await axios.put(`${this.config.url}/api/user/${username}`, body, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }

  async revokeSubscription(username: string): Promise<string> {
    await this.authenticate();
    const res = await axios.post(`${this.config.url}/api/user/${username}/revoke_sub`, {}, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return res.data.subscription_url;
  }

  async resetDataUsage(username: string): Promise<void> {
    await this.authenticate();
    await axios.post(`${this.config.url}/api/user/${username}/reset`, {}, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }
}
```

```typescript
// src/infrastructure/panels/XUIAdapter.ts (نمونه X-UI / 3x-ui)
import axios from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import * as tough from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

export class XUIAdapter implements IPanelAdapter {
  private client: ReturnType<typeof wrapper>;
  private jar: tough.CookieJar;

  constructor(private config: { url: string; username: string; password: string; inboundId: string }) {
    this.jar = new tough.CookieJar();
    this.client = wrapper(axios.create({ jar: this.jar }));
  }

  async authenticate(): Promise<void> {
    await this.client.post(`${this.config.url}/login`, {
      username: this.config.username, password: this.config.password,
    });
  }

  async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
    await this.authenticate();
    const uuid = crypto.randomUUID();
    const settings = JSON.stringify({
      clients: [{ id: uuid, email: input.username, totalGB: input.volume * 1024 ** 3, expiryTime: (Date.now() + input.duration * 86400000), enable: true, subId: crypto.randomBytes(8).toString('hex') }],
    });
    await this.client.post(`${this.config.url}/panel/api/inbounds/addClient`, {
      id: parseInt(this.config.inboundId), settings,
    });
    return { username: input.username, status: 'active', usedTraffic: 0, dataLimit: input.volume * 1024 ** 3, expire: Math.floor(Date.now()/1000) + input.duration * 86400 };
  }

  async getUser(username: string): Promise<PanelUserInfo | null> {
    await this.authenticate();
    const res = await this.client.get(`${this.config.url}/panel/api/inbounds/getClientTraffics/${username}`);
    const data = res.data?.obj;
    if (!data) return null;
    return { username: data.email, status: data.enable ? 'active' : 'disabled', usedTraffic: data.up + data.down, dataLimit: data.total, expire: Math.floor(data.expiryTime / 1000) };
  }

  async removeUser(username: string): Promise<void> {
    await this.authenticate();
    await this.client.post(`${this.config.url}/panel/api/inbounds/${this.config.inboundId}/delClientByEmail/${username}`);
  }

  async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> { /* ... */ }
  async revokeSubscription(username: string): Promise<string> { return ''; }
  async resetDataUsage(username: string): Promise<void> {
    await this.authenticate();
    await this.client.post(`${this.config.url}/panel/api/inbounds/${this.config.inboundId}/resetClientTraffic/${username}`);
  }
}
```

```typescript
// src/infrastructure/panels/PanelFactory.ts
import { PanelType } from '@prisma/client';
import { IPanelAdapter } from '../../core/interfaces/IPanelAdapter';
import { MarzbanAdapter } from './MarzbanAdapter';
import { XUIAdapter } from './XUIAdapter';
import { prisma } from '../database/prisma';

export class PanelFactory {
  static create(panel: { type: PanelType; url: string; username: string; password: string; inboundId?: string; inbounds?: string }): IPanelAdapter {
    switch (panel.type) {
      case 'MARZBAN':     return new MarzbanAdapter(panel);
      case 'MARZNESHIN':  return new MarzneshinAdapter(panel);
      case 'X_UI':        return new XUIAdapter({ ...panel, inboundId: panel.inboundId ?? '1' });
      case 'S_UI':        return new SUIAdapter(panel);
      case 'WGDASHBOARD': return new WGDashboardAdapter(panel);
      case 'MIKROTIK':    return new MikrotikAdapter(panel);
      default: throw new Error(`Unsupported panel: ${panel.type}`);
    }
  }

  static async createFromName(name: string): Promise<IPanelAdapter> {
    const panel = await prisma.panel.findUnique({ where: { name } });
    if (!panel) throw new Error(`Panel not found: ${name}`);
    return PanelFactory.create(panel);
  }
}
```

---

### Middleware Examples

```typescript
// src/presentation/middlewares/rateLimiter.ts
import { Context, NextFunction } from 'grammy';
import { prisma } from '../../infrastructure/database/prisma';

export async function rateLimiterMiddleware(ctx: Context, next: NextFunction) {
  if (!ctx.from) return next();
  const now = Math.floor(Date.now() / 1000);
  const user = await prisma.user.findUnique({ where: { chatId: BigInt(ctx.from.id) } });
  if (!user) return next();

  const settings = await prisma.botSetting.findFirst();
  const limit = settings?.messageLimitPerMin ?? 10;
  const elapsed = now - user.lastMessageTime;

  if (elapsed >= 60) {
    await prisma.user.update({ where: { id: user.id }, data: { lastMessageTime: now, messageCount: 1 } });
  } else if (user.messageCount >= limit) {
    await ctx.reply('⚠️ تعداد پیام‌های شما بیش از حد مجاز است.');
    return;
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { messageCount: { increment: 1 } } });
  }
  return next();
}
```

```typescript
// src/presentation/middlewares/channelMembership.ts
import { Context, NextFunction } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { prisma } from '../../infrastructure/database/prisma';

export async function channelMembershipMiddleware(ctx: Context, next: NextFunction) {
  if (!ctx.from) return next();
  const channels = await prisma.channel.findMany();
  if (channels.length === 0) return next();

  for (const ch of channels) {
    try {
      const member = await ctx.api.getChatMember(ch.link, ctx.from.id);
      if (['left', 'kicked'].includes(member.status)) {
        const kb = new InlineKeyboard()
          .url('🔗 عضویت در کانال', `https://t.me/${ch.link.replace('@', '')}`)
          .row()
          .text('✅ بررسی عضویت', 'confirmchannel');
        await ctx.reply('⚠️ لطفاً ابتدا در کانال عضو شوید:', { reply_markup: kb });
        return;
      }
    } catch { /* skip */ }
  }
  return next();
}
```

---

### Scheduled Job Example (BullMQ)

```typescript
// src/infrastructure/jobs/expiryWarning.ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../database/prisma';
import { PanelFactory } from '../panels/PanelFactory';
import { Bot } from 'grammy';

export function initExpiryWarningJob(bot: Bot, redis: IORedis) {
  const queue = new Queue('expiry-warning', { connection: redis });
  queue.add('check', {}, { repeat: { every: 5 * 60 * 1000 } }); // هر ۵ دقیقه

  new Worker('expiry-warning', async () => {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['ACTIVE', 'END_OF_VOLUME'] }, productName: { not: 'usertest' } },
      take: 5,
    });

    for (const inv of invoices) {
      try {
        const adapter = await PanelFactory.createFromName(inv.serviceLocation);
        const info = await adapter.getUser(inv.username);
        if (!info) continue;

        const daysLeft = Math.floor((info.expire - Date.now() / 1000) / 86400) + 1;
        if (daysLeft <= 2 && daysLeft > 0) {
          await bot.api.sendMessage(Number(inv.userId),
            `⚠️ سرویس ${inv.username}: ${daysLeft} روز باقی‌مانده`,
            { reply_markup: { inline_keyboard: [[{ text: '🔄 تمدید', callback_data: `extend_${inv.username}` }]] } }
          );
          await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'END_OF_TIME' } });
        }
      } catch (err) { console.error(`Expiry check failed for ${inv.username}:`, err); }
    }
  }, { connection: redis, concurrency: 1 });
}
```

---

### Admin Statistics Handler

```typescript
// src/presentation/handlers/admin/StatisticsHandler.ts
import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';

export class StatisticsHandler {
  async handle(ctx: Context) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000);

    const [users, activeInvoices, testAccounts, totalRevenue, todayRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.invoice.count({ where: { status: 'ACTIVE' } }),
      prisma.invoice.count({ where: { productName: 'usertest', status: 'ACTIVE' } }),
      prisma.invoice.aggregate({ _sum: { productPrice: true } }),
      prisma.invoice.aggregate({ _sum: { productPrice: true }, where: { createdAt: { gte: dayAgo } } }),
    ]);

    await ctx.reply(
      `📊 <b>آمار ربات</b>\n\n` +
      `👥 کل کاربران: <b>${users}</b>\n` +
      `✅ سرویس‌های فعال: <b>${activeInvoices}</b>\n` +
      `🧪 اکانت‌های تست: <b>${testAccounts}</b>\n` +
      `💰 فروش کل: <b>${totalRevenue._sum.productPrice ?? 0}</b> تومان\n` +
      `📅 فروش امروز: <b>${todayRevenue._sum.productPrice ?? 0}</b> تومان`,
      { parse_mode: 'HTML' }
    );
  }
}
```

---

### Discount Code Use Case

```typescript
// src/core/use-cases/ApplyDiscountCode.ts
import { prisma } from '../../infrastructure/database/prisma';

interface DiscountResult {
  success: boolean;
  discountPercent?: number;
  error?: string;
}

export class ApplyDiscountCodeUseCase {
  async execute(code: string): Promise<DiscountResult> {
    const discount = await prisma.discountCode.findUnique({ where: { code } });

    if (!discount || !discount.isActive) return { success: false, error: 'کد تخفیف نامعتبر است' };
    if (discount.expiresAt && discount.expiresAt < new Date()) return { success: false, error: 'کد تخفیف منقضی شده' };
    if (discount.usedCount >= discount.maxUses) return { success: false, error: 'ظرفیت استفاده از کد تمام شده' };

    await prisma.discountCode.update({ where: { code }, data: { usedCount: { increment: 1 } } });
    return { success: true, discountPercent: discount.percent };
  }
}
```

---

### Affiliate Handler

```typescript
// src/presentation/handlers/AffiliateHandler.ts
import { Context } from 'grammy';
import { prisma } from '../../infrastructure/database/prisma';

export class AffiliateHandler {
  async showRefLink(ctx: Context) {
    if (!ctx.from) return;
    const user = await prisma.user.findUnique({ where: { chatId: BigInt(ctx.from.id) } });
    if (!user) return;

    const botInfo = await ctx.api.getMe();
    const refLink = `https://t.me/${botInfo.username}?start=ref_${user.refCode}`;

    await ctx.reply(
      `🔗 لینک زیرمجموعه‌گیری شما:\n<code>${refLink}</code>\n\n` +
      `👥 تعداد زیرمجموعه‌ها: <b>${user.affiliateCount}</b>`,
      { parse_mode: 'HTML' }
    );
  }

  async processReferral(ctx: Context, refCode: string) {
    if (!ctx.from) return;
    const settings = await prisma.affiliateSetting.findFirst();
    if (!settings?.isEnabled) return;

    const referrer = await prisma.user.findUnique({ where: { refCode } });
    if (!referrer || referrer.chatId === BigInt(ctx.from.id)) return;

    await prisma.user.update({ where: { id: referrer.id }, data: {
      affiliateCount: { increment: 1 },
      balance: { increment: settings.rewardAmount },
    }});

    await prisma.user.update({ where: { chatId: BigInt(ctx.from.id) }, data: { referredBy: referrer.chatId } });
  }
}
```


