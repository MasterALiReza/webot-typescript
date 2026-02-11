# راهنمای کامل تبدیل Bot Mirza Panel به معماری مدرن

## 1. تحلیل وضعیت فعلی

### ساختار کنونی (PHP Monolithic)
- فایل‌های جدا برای هر بخش (admin.php, index.php, marzban.php, ...)
- منطق business با presentation مخلوط شده
- کد تکراری زیاد
- hard-coded configs
- بدون dependency injection
- بدون ORM
- security issues احتمالی

### مشکلات اصلی
- نگهداری سخت
- تست کردن سخت
- مقیاس‌پذیری ضعیف
- کد اسپاگتی
- coupling بالا

---

## 2. معماری پیشنهادی

### انتخاب Technology Stack

**Backend Framework: Node.js + TypeScript**
چرا؟
- async/await native
- ecosystem قوی برای telegram bots
- performance خوب
- typescript برای type safety
- همه چیز javascript

**Alternative: Python + FastAPI**
چرا؟
- کد ساده‌تر
- کتابخانه‌های خوب
- برای مبتدی بهتر

**توصیه من: Node.js + TypeScript**

### کتابخانه‌های اصلی

```json
{
  "grammy": "telegram bot framework مدرن",
  "prisma": "ORM قدرتمند",
  "zod": "validation",
  "winston": "logging",
  "bull": "job queue",
  "redis": "caching + sessions",
  "axios": "http client"
}
```

---

## 3. معماری Clean Architecture

```
src/
├── core/                    # Business Logic
│   ├── entities/           # Data Models
│   ├── use-cases/          # Business Rules
│   └── interfaces/         # Contracts
│
├── infrastructure/         # External Services
│   ├── database/          # Prisma
│   ├── telegram/          # Grammy
│   ├── payment/           # Payment Gateways
│   └── panels/            # Marzban/X-UI APIs
│
├── application/           # Application Layer
│   ├── services/         # Business Services
│   ├── dto/              # Data Transfer Objects
│   └── validators/       # Input Validation
│
├── presentation/         # Interface Layer
│   ├── bot/             # Bot Handlers
│   ├── keyboards/       # Telegram Keyboards
│   └── middlewares/     # Bot Middlewares
│
└── shared/              # Shared Utilities
    ├── utils/
    ├── constants/
    └── errors/
```

---

## 4. نقشه راه مهاجرت (Step by Step)

### Phase 1: Setup (هفته 1)
```bash
# 1. Initialize project
mkdir bot-mirza-modern
cd bot-mirza-modern
npm init -y

# 2. Install dependencies
npm install grammy prisma @prisma/client zod winston
npm install -D typescript @types/node ts-node nodemon

# 3. Setup TypeScript
npx tsc --init

# 4. Setup Prisma
npx prisma init
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
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

### Phase 2: Database Migration (هفته 2)

**از table.php استخراج schema کامل (تمام جداول اصلی):**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ─── User ────────────────────────────────────────────
model User {
  id                  Int       @id @default(autoincrement())
  chatId              BigInt    @unique @map("chat_id")
  username            String?   @db.VarChar(255)
  firstName           String?   @map("first_name") @db.VarChar(255)
  phoneNumber         String?   @map("phone_number") @db.VarChar(20)
  balance             Decimal   @default(0) @db.Decimal(12, 2)
  isVerified          Boolean   @default(false) @map("is_verified")
  userStatus          UserStatus @default(ACTIVE) @map("user_status")
  step                String    @default("home") @db.VarChar(100)
  refCode             String    @unique @db.Char(32) @map("ref_code")
  referredBy          BigInt?   @map("referred_by")
  affiliateCount      Int       @default(0) @map("affiliate_count")
  rollAccepted        Boolean   @default(false) @map("roll_accepted")
  limitUserTest       Int       @default(0) @map("limit_user_test")
  messageCount        Int       @default(0) @map("message_count")
  lastMessageTime     Int       @default(0) @map("last_message_time")
  descriptionBlocking String?   @map("description_blocking") @db.Text
  // Processing values for multi-step flows
  processingValue     String    @default("0") @map("processing_value") @db.VarChar(500)
  processingValueOne  String    @default("0") @map("processing_value_one") @db.VarChar(500)
  processingValueTwo  String    @default("0") @map("processing_value_two") @db.VarChar(500)
  processingValueThree String   @default("0") @map("processing_value_three") @db.VarChar(500)
  processingValueFour String    @default("0") @map("processing_value_four") @db.VarChar(100)
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  invoices        Invoice[]
  paymentReports  PaymentReport[]
  supportTickets  SupportTicket[]

  @@map("users")
}

enum UserStatus {
  ACTIVE
  BLOCKED
}

// ─── Admin ───────────────────────────────────────────
model Admin {
  id        Int       @id @default(autoincrement())
  chatId    BigInt    @unique @map("chat_id")
  role      AdminRole @default(ADMIN)
  createdAt DateTime  @default(now()) @map("created_at")

  @@map("admins")
}

enum AdminRole {
  SUPER_ADMIN
  ADMIN
  SALES
  SUPPORT
}

// ─── Panel (6 نوع پنل) ──────────────────────────────
model Panel {
  id              Int        @id @default(autoincrement())
  name            String     @unique @db.VarChar(255)
  type            PanelType
  url             String     @db.VarChar(500)
  username        String     @db.VarChar(255)
  password        String     @db.VarChar(255)
  status          PanelStatus @default(ACTIVE)
  inbounds        String?    @db.Text   // JSON array of inbound configs
  inboundId       String?    @map("inbound_id") @db.VarChar(200)
  methodUsername  UsernameMethod @default(RANDOM) @map("method_username")
  onHoldEnabled   Boolean    @default(false) @map("on_hold_enabled")
  dateLogin       String?    @map("date_login") @db.Text // cached token JSON
  createdAt       DateTime   @default(now()) @map("created_at")

  products  Product[]
  invoices  Invoice[]

  @@map("panels")
}

enum PanelType {
  MARZBAN
  MARZNESHIN
  X_UI
  S_UI
  WGDASHBOARD
  MIKROTIK
}

enum PanelStatus {
  ACTIVE
  INACTIVE
}

enum UsernameMethod {
  RANDOM
  CUSTOM_RANDOM
  CUSTOM_ONLY
  CHAT_ID_RANDOM
  CHAT_ID_ONLY
}

// ─── Product ─────────────────────────────────────────
model Product {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(255)
  description String?  @db.Text
  price       Decimal  @db.Decimal(12, 2)
  volume      Int      // GB
  duration    Int      // روز
  panelId     Int      @map("panel_id")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")

  panel     Panel     @relation(fields: [panelId], references: [id])
  invoices  Invoice[]

  @@map("products")
}

// ─── Invoice (جدول اصلی خرید) ────────────────────────
// معادل جدول invoice در PHP اصلی
model Invoice {
  id              Int           @id @default(autoincrement())
  userId          Int           @map("user_id")
  productId       Int           @map("product_id")
  panelId         Int           @map("panel_id")
  username        String        @db.VarChar(255)
  configUrl       String?       @map("config_url") @db.Text
  subscriptionUrl String?       @map("subscription_url") @db.Text
  serviceLocation String        @map("service_location") @db.VarChar(255)
  productName     String        @map("product_name") @db.VarChar(255)
  productPrice    Decimal       @map("product_price") @db.Decimal(12, 2)
  status          InvoiceStatus @default(ACTIVE)
  expiresAt       DateTime?     @map("expires_at")
  createdAt       DateTime      @default(now()) @map("created_at")

  user    User    @relation(fields: [userId], references: [id])
  product Product @relation(fields: [productId], references: [id])
  panel   Panel   @relation(fields: [panelId], references: [id])

  @@map("invoices")
}

enum InvoiceStatus {
  ACTIVE
  END_OF_TIME
  END_OF_VOLUME
  WARNED          // sendedwarn
  DISABLED
  REMOVED         // removeTime
}

// ─── PaymentReport (گزارش پرداخت‌ها) ─────────────────
model PaymentReport {
  id              Int           @id @default(autoincrement())
  userId          Int           @map("user_id")
  orderId         String        @unique @map("order_id") @db.VarChar(100)
  amount          Decimal       @db.Decimal(12, 2)
  method          PaymentMethod
  status          PaymentStatus @default(PENDING)
  transactionId   String?       @map("transaction_id") @db.VarChar(255)
  description     String?       @db.Text
  photoId         String?       @map("photo_id") @db.VarChar(500)
  createdAt       DateTime      @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("payment_reports")
}

enum PaymentMethod {
  CARD_TO_CARD
  NOWPAYMENTS
  AQAYE_PARDAKHT
  DIGI_PAY
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

// ─── SupportTicket ───────────────────────────────────
model SupportTicket {
  id        Int          @id @default(autoincrement())
  userId    Int          @map("user_id")
  message   String       @db.Text
  response  String?      @db.Text
  status    TicketStatus @default(OPEN)
  createdAt DateTime     @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("support_tickets")
}

enum TicketStatus {
  OPEN
  ANSWERED
  CLOSED
}

// ─── BotText (متون قابل تنظیم) ───────────────────────
// معادل جدول textbot در PHP اصلی
model BotText {
  id    Int    @id @default(autoincrement())
  key   String @unique @db.VarChar(100)
  value String @db.Text

  @@map("bot_texts")
}

// ─── HelpItem (آیتم‌های راهنما) ───────────────────────
model HelpItem {
  id      Int    @id @default(autoincrement())
  title   String @db.VarChar(255)
  content String @db.Text
  fileId  String? @map("file_id") @db.VarChar(500)
  sortOrder Int  @default(0) @map("sort_order")

  @@map("help_items")
}

// ─── Channel (عضویت اجباری) ──────────────────────────
model Channel {
  id   Int    @id @default(autoincrement())
  link String @db.VarChar(200)

  @@map("channels")
}

// ─── Affiliate (تنظیمات زیرمجموعه‌گیری) ──────────────
model AffiliateSetting {
  id              Int     @id @default(autoincrement())
  isEnabled       Boolean @default(false) @map("is_enabled")
  discountEnabled Boolean @default(false) @map("discount_enabled")
  rewardAmount    Decimal @default(0) @map("reward_amount") @db.Decimal(12, 2)
  discountPercent Int     @default(0) @map("discount_percent")

  @@map("affiliate_settings")
}

// ─── DiscountCode (کدهای تخفیف) ──────────────────────
model DiscountCode {
  id          Int      @id @default(autoincrement())
  code        String   @unique @db.VarChar(100)
  percent     Int      // درصد تخفیف
  maxUses     Int      @default(1) @map("max_uses")
  usedCount   Int      @default(0) @map("used_count")
  isActive    Boolean  @default(true) @map("is_active")
  expiresAt   DateTime? @map("expires_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("discount_codes")
}

// ─── Protocol (پروتکل‌های VPN) ────────────────────────
model Protocol {
  id   Int    @id @default(autoincrement())
  name String @unique @db.VarChar(100)

  @@map("protocols")
}

// ─── BotSetting (تنظیمات کلی ربات) ───────────────────
// معادل جدول setting در PHP اصلی
model BotSetting {
  id                  Int     @id @default(autoincrement())
  botStatus           Boolean @default(true) @map("bot_status")
  verifyRequired      Boolean @default(false) @map("verify_required")
  rulesRequired       Boolean @default(false) @map("rules_required")
  phoneRequired       Boolean @default(false) @map("phone_required")
  iranOnlyPhone       Boolean @default(false) @map("iran_only_phone")
  helpEnabled         Boolean @default(false) @map("help_enabled")
  testAccountLimit    Int     @default(0) @map("test_account_limit")
  removeDaysAfterExp  Int     @default(7) @map("remove_days_after_exp")
  messageLimitPerMin  Int     @default(10) @map("message_limit_per_min")
  reportChannelId     String? @map("report_channel_id") @db.VarChar(100)
  cardNumber          String? @map("card_number") @db.VarChar(50)
  // Payment gateway toggles
  nowPaymentsEnabled  Boolean @default(false) @map("nowpayments_enabled")
  digiPayEnabled      Boolean @default(false) @map("digipay_enabled")
  aqayePardakhtEnabled Boolean @default(false) @map("aqaye_pardakht_enabled")
  cardToCardEnabled   Boolean @default(true) @map("card_to_card_enabled")

  @@map("bot_settings")
}
```

**Migration از MySQL فعلی:**
```bash
# 1. Export current data
mysqldump -u root -p database_name > old_data.sql

# 2. Run prisma migration
npx prisma migrate dev --name init

# 3. Write migration script
```

### Phase 3: Core Entities (هفته 3)

```typescript
// src/core/entities/User.ts
export class User {
  constructor(
    public readonly id: number,
    public readonly chatId: number,
    public username: string | null,
    public firstName: string | null,
    public phoneNumber: string | null,
    public balance: number,
    public isVerified: boolean
  ) {}

  canPurchase(amount: number): boolean {
    return this.balance >= amount;
  }

  addBalance(amount: number): void {
    this.balance += amount;
  }

  deductBalance(amount: number): void {
    if (!this.canPurchase(amount)) {
      throw new Error('Insufficient balance');
    }
    this.balance -= amount;
  }
}
```

```typescript
// src/core/entities/Product.ts
export class Product {
  constructor(
    public readonly id: number,
    public name: string,
    public price: number,
    public volume: number,
    public duration: number,
    public panelId: number,
    public isActive: boolean
  ) {}

  isAvailable(): boolean {
    return this.isActive;
  }
}
```

### Phase 4: Use Cases (هفته 4)

```typescript
// src/core/use-cases/PurchaseProduct.ts
import { User } from '../entities/User';
import { Product } from '../entities/Product';

export interface PurchaseProductInput {
  userId: number;
  productId: number;
}

export interface PurchaseProductOutput {
  success: boolean;
  purchaseId?: number;
  configUrl?: string;
  error?: string;
}

export class PurchaseProductUseCase {
  constructor(
    private userRepository: IUserRepository,
    private productRepository: IProductRepository,
    private panelService: IPanelService,
    private purchaseRepository: IPurchaseRepository
  ) {}

  async execute(input: PurchaseProductInput): Promise<PurchaseProductOutput> {
    // 1. Get user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // 2. Get product
    const product = await this.productRepository.findById(input.productId);
    if (!product || !product.isAvailable()) {
      return { success: false, error: 'Product not available' };
    }

    // 3. Check balance
    if (!user.canPurchase(product.price)) {
      return { success: false, error: 'Insufficient balance' };
    }

    // 4. Create config in panel
    const config = await this.panelService.createUser({
      volume: product.volume,
      duration: product.duration,
      panelId: product.panelId
    });

    // 5. Deduct balance
    user.deductBalance(product.price);
    await this.userRepository.update(user);

    // 6. Save purchase
    const purchase = await this.purchaseRepository.create({
      userId: user.id,
      productId: product.id,
      panelId: product.panelId,
      username: config.username,
      configUrl: config.url,
      expiresAt: config.expiresAt
    });

    return {
      success: true,
      purchaseId: purchase.id,
      configUrl: config.url
    };
  }
}
```

### Phase 5: Infrastructure (هفته 5-6)

```typescript
// src/infrastructure/database/repositories/UserRepository.ts
import { PrismaClient } from '@prisma/client';
import { User } from '../../../core/entities/User';
import { IUserRepository } from '../../../core/interfaces/IUserRepository';

export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id }
    });

    if (!user) return null;

    return new User(
      user.id,
      Number(user.chatId),
      user.username,
      user.firstName,
      user.phoneNumber,
      Number(user.balance),
      user.isVerified
    );
  }

  async findByChatId(chatId: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { chatId: BigInt(chatId) }
    });

    if (!user) return null;

    return new User(
      user.id,
      Number(user.chatId),
      user.username,
      user.firstName,
      user.phoneNumber,
      Number(user.balance),
      user.isVerified
    );
  }

  async create(data: Omit<User, 'id'>): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        chatId: BigInt(data.chatId),
        username: data.username,
        firstName: data.firstName,
        phoneNumber: data.phoneNumber,
        balance: data.balance,
        isVerified: data.isVerified
      }
    });

    return new User(
      user.id,
      Number(user.chatId),
      user.username,
      user.firstName,
      user.phoneNumber,
      Number(user.balance),
      user.isVerified
    );
  }

  async update(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        username: user.username,
        firstName: user.firstName,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        isVerified: user.isVerified
      }
    });
  }
}
```

```typescript
// src/infrastructure/panels/MarzbanService.ts
import axios from 'axios';

export interface PanelConfig {
  url: string;
  username: string;
  password: string;
}

export interface CreateUserInput {
  volume: number;
  duration: number;
  panelId: number;
}

export interface CreateUserOutput {
  username: string;
  url: string;
  expiresAt: Date;
}

export class MarzbanService {
  private token: string | null = null;

  constructor(private config: PanelConfig) {}

  private async getToken(): Promise<string> {
    if (this.token) return this.token;

    const response = await axios.post(`${this.config.url}/api/admin/token`, {
      username: this.config.username,
      password: this.config.password
    });

    this.token = response.data.access_token;
    return this.token;
  }

  async createUser(input: CreateUserInput): Promise<CreateUserOutput> {
    const token = await this.getToken();
    
    const username = this.generateUsername();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.duration);

    const response = await axios.post(
      `${this.config.url}/api/user`,
      {
        username: username,
        data_limit: input.volume * 1024 * 1024 * 1024, // GB to bytes
        expire: Math.floor(expiresAt.getTime() / 1000),
        proxies: {
          vmess: {},
          vless: {}
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    return {
      username: response.data.username,
      url: response.data.subscription_url,
      expiresAt: expiresAt
    };
  }

  private generateUsername(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getUser(username: string): Promise<any> {
    const token = await this.getToken();
    
    const response = await axios.get(
      `${this.config.url}/api/user/${username}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    return response.data;
  }

  async deleteUser(username: string): Promise<void> {
    const token = await this.getToken();
    
    await axios.delete(
      `${this.config.url}/api/user/${username}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }
}
```

### Phase 6: Bot Handlers (هفته 7-8)

```typescript
// src/presentation/bot/handlers/StartHandler.ts
import { Context } from 'grammy';
import { IUserRepository } from '../../../core/interfaces/IUserRepository';

export class StartHandler {
  constructor(private userRepository: IUserRepository) {}

  async handle(ctx: Context): Promise<void> {
    const chatId = ctx.from?.id;
    if (!chatId) return;

    // Check if user exists
    let user = await this.userRepository.findByChatId(chatId);

    if (!user) {
      // Create new user
      user = await this.userRepository.create({
        chatId: chatId,
        username: ctx.from?.username ?? null,
        firstName: ctx.from?.first_name ?? null,
        phoneNumber: null,
        balance: 0,
        isVerified: false
      });
    }

    const keyboard = this.getMainKeyboard(user.isVerified);

    await ctx.reply(
      `سلام ${user.firstName ?? 'کاربر'}!\n\nبه ربات فروش VPN خوش آمدید`,
      { reply_markup: keyboard }
    );
  }

  private getMainKeyboard(isVerified: boolean) {
    if (!isVerified) {
      return {
        keyboard: [
          [{ text: '✅ تایید شماره', request_contact: true }],
          [{ text: '❓ راهنما' }]
        ],
        resize_keyboard: true
      };
    }

    return {
      keyboard: [
        [{ text: '🛒 خرید سرویس' }, { text: '📦 سرویس‌های من' }],
        [{ text: '💰 کیف پول' }, { text: '❓ راهنما' }],
        [{ text: '👤 پروفایل' }, { text: '🎫 تیکت' }]
      ],
      resize_keyboard: true
    };
  }
}
```

```typescript
// src/presentation/bot/handlers/PurchaseHandler.ts
import { Context, InlineKeyboard } from 'grammy';
import { IProductRepository } from '../../../core/interfaces/IProductRepository';
import { PurchaseProductUseCase } from '../../../core/use-cases/PurchaseProduct';

export class PurchaseHandler {
  constructor(
    private productRepository: IProductRepository,
    private purchaseProductUseCase: PurchaseProductUseCase
  ) {}

  async showProducts(ctx: Context): Promise<void> {
    const products = await this.productRepository.findAll({ isActive: true });

    if (products.length === 0) {
      await ctx.reply('محصولی موجود نیست');
      return;
    }

    const keyboard = new InlineKeyboard();

    for (const product of products) {
      keyboard.text(
        `${product.name} - ${product.price.toLocaleString('fa-IR')} تومان`,
        `buy:${product.id}`
      ).row();
    }

    await ctx.reply('محصول مورد نظر را انتخاب کنید:', {
      reply_markup: keyboard
    });
  }

  async confirmPurchase(ctx: Context, productId: number): Promise<void> {
    const product = await this.productRepository.findById(productId);
    
    if (!product) {
      await ctx.answerCallbackQuery({ text: 'محصول یافت نشد' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('✅ تایید خرید', `confirm:${productId}`)
      .text('❌ انصراف', 'cancel').row();

    await ctx.reply(
      `📦 ${product.name}\n` +
      `💰 قیمت: ${product.price.toLocaleString('fa-IR')} تومان\n` +
      `📊 حجم: ${product.volume} گیگابایت\n` +
      `⏰ مدت: ${product.duration} روز`,
      { reply_markup: keyboard }
    );
  }

  async executePurchase(ctx: Context, productId: number): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.answerCallbackQuery({ text: 'در حال پردازش...' });

    const result = await this.purchaseProductUseCase.execute({
      userId: userId,
      productId: productId
    });

    if (!result.success) {
      await ctx.reply(`❌ خطا: ${result.error}`);
      return;
    }

    await ctx.reply(
      `✅ خرید با موفقیت انجام شد\n\n` +
      `🔗 لینک کانفیگ:\n${result.configUrl}`
    );
  }
}
```

### Phase 7: Multi-Panel Adapter (هفته 7)

> معماری اصلی ربات از ۶ نوع پنل مختلف پشتیبانی می‌کند. الگوی Adapter Pattern استفاده می‌شود.

```typescript
// src/core/interfaces/IPanelAdapter.ts
export interface CreateUserInput {
  username: string;
  volume: number;      // GB
  duration: number;    // days
  inbounds?: string;
}

export interface PanelUserInfo {
  username: string;
  status: 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold';
  usedTraffic: number;
  dataLimit: number;
  expire: number;       // unix timestamp
  subscriptionUrl?: string;
}

export interface IPanelAdapter {
  authenticate(): Promise<void>;
  createUser(input: CreateUserInput): Promise<PanelUserInfo>;
  getUser(username: string): Promise<PanelUserInfo | null>;
  removeUser(username: string): Promise<void>;
  modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void>;
  revokeSubscription(username: string): Promise<string>; // returns new sub url
  resetDataUsage(username: string): Promise<void>;
  getSystemStats?(): Promise<any>;
}
```

```typescript
// src/infrastructure/panels/MarzbanAdapter.ts
export class MarzbanAdapter implements IPanelAdapter {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private config: { url: string; username: string; password: string }) {}

  async authenticate(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiry) return;

    const res = await axios.post(`${this.config.url}/api/admin/token`, {
      username: this.config.username,
      password: this.config.password,
    });
    this.token = res.data.access_token;
    this.tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 min
  }

  async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
    await this.authenticate();
    const expire = Math.floor(Date.now() / 1000) + input.duration * 86400;
    const res = await axios.post(`${this.config.url}/api/user`, {
      username: input.username,
      data_limit: input.volume * 1024 ** 3,
      expire,
      proxies: { vmess: {}, vless: {} },
    }, { headers: { Authorization: `Bearer ${this.token}` } });
    return this.mapResponse(res.data);
  }

  // ... getUser, removeUser, modifyUser, revokeSubscription, resetDataUsage
}
```

```typescript
// src/infrastructure/panels/PanelFactory.ts
export class PanelFactory {
  static create(panel: Panel): IPanelAdapter {
    switch (panel.type) {
      case 'MARZBAN':     return new MarzbanAdapter(panel);
      case 'MARZNESHIN':  return new MarzneshinAdapter(panel);
      case 'X_UI':        return new XUIAdapter(panel);
      case 'S_UI':        return new SUIAdapter(panel);
      case 'WGDASHBOARD': return new WGDashboardAdapter(panel);
      case 'MIKROTIK':    return new MikrotikAdapter(panel);
      default: throw new Error(`Unsupported panel type: ${panel.type}`);
    }
  }
}
```

### Phase 8: Middleware Stack (هفته 8)

> معادل بررسی‌های inline در index.php اصلی، اما ماژولار و قابل تست.

```typescript
// src/presentation/middlewares/rateLimiter.ts
import { Context, NextFunction } from 'grammy';
import { prisma } from '../../infrastructure/database/prisma';

export async function rateLimiterMiddleware(ctx: Context, next: NextFunction) {
  if (!ctx.from) return next();
  const now = Math.floor(Date.now() / 1000);
  const user = await prisma.user.findUnique({ where: { chatId: BigInt(ctx.from.id) } });
  if (!user) return next();

  const elapsed = now - user.lastMessageTime;
  if (elapsed >= 60) {
    await prisma.user.update({ where: { id: user.id }, data: { lastMessageTime: now, messageCount: 1 } });
  } else {
    const settings = await prisma.botSetting.findFirst();
    if (user.messageCount >= (settings?.messageLimitPerMin ?? 10)) {
      await ctx.reply('⚠️ تعداد پیام‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.');
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { messageCount: { increment: 1 } } });
  }
  return next();
}
```

```typescript
// src/presentation/middlewares/channelMembership.ts
export async function channelMembershipMiddleware(ctx: Context, next: NextFunction) {
  if (!ctx.from) return next();
  const channels = await prisma.channel.findMany();
  for (const ch of channels) {
    try {
      const member = await ctx.api.getChatMember(ch.link, ctx.from.id);
      if (['left', 'kicked'].includes(member.status)) {
        await ctx.reply('⚠️ لطفاً ابتدا در کانال ما عضو شوید', {
          reply_markup: new InlineKeyboard()
            .url('🔗 عضویت', `https://t.me/${ch.link.replace('@', '')}`)
            .row().text('✅ تأیید عضویت', 'confirmchannel')
        });
        return;
      }
    } catch { /* channel not found, skip */ }
  }
  return next();
}
```

```typescript
// src/presentation/middlewares/index.ts - ترتیب اعمال
bot.use(rateLimiterMiddleware);
bot.use(botStatusMiddleware);           // بررسی روشن/خاموش بودن ربات
bot.use(userRegistrationMiddleware);    // ثبت‌نام خودکار کاربر جدید
bot.use(userBlockCheckMiddleware);      // بررسی بلاک نبودن
bot.use(phoneVerificationMiddleware);   // تأیید شماره (در صورت فعال بودن)
bot.use(rulesAcceptanceMiddleware);     // قبول قوانین (در صورت فعال بودن)
bot.use(channelMembershipMiddleware);   // عضویت اجباری
```

### Phase 9: Scheduled Jobs / Cron Jobs (هفته 9)

> معادل ۵ فایل cron اصلی، با BullMQ برای reliability.

```typescript
// src/infrastructure/jobs/scheduler.ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!);

// ۱. ExpiryWarningJob (معادل cronday.php)
const expiryQueue = new Queue('expiry-warning', { connection });
expiryQueue.add('check', {}, { repeat: { every: 300_000 } }); // هر ۵ دقیقه

new Worker('expiry-warning', async () => {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ['ACTIVE', 'END_OF_VOLUME'] }, productName: { not: 'usertest' } },
    take: 5, orderBy: { createdAt: 'asc' },
  });
  for (const inv of invoices) {
    const adapter = await PanelFactory.createFromName(inv.serviceLocation);
    const info = await adapter.getUser(inv.username);
    if (!info || info.status === 'Unsuccessful') continue;
    const daysLeft = Math.floor((info.expire - Date.now() / 1000) / 86400) + 1;
    if (daysLeft <= 2 && daysLeft > 0) {
      await bot.api.sendMessage(inv.userId, `⚠️ سرویس ${inv.username} تا ${daysLeft} روز دیگر منقضی می‌شود`);
      await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'END_OF_TIME' } });
    }
  }
}, { connection });

// ۲. VolumeWarningJob (معادل cronvolume.php)
// ۳. AutoPaymentJob (معادل croncard.php)
// ۴. TestConfigCleanupJob (معادل configtest.php)
// ۵. ExpiredServiceRemovalJob (معادل removeexpire.php)
// ساختار مشابه - هر کدام یک Queue + Worker جداگانه
```

### Phase 10: Admin Handlers (هفته 10)

> معادل admin.php اصلی (۲۴۵۵ خط) - تقسیم به handler‌های مجزا.

```typescript
// src/presentation/handlers/admin/StatisticsHandler.ts
export class StatisticsHandler {
  async handle(ctx: Context) {
    const now = Date.now() / 1000;
    const dayAgo = now - 86400;
    const [userCount, testCount, totalRevenue, dayRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.invoice.count({ where: { productName: 'usertest' } }),
      prisma.invoice.aggregate({ _sum: { productPrice: true }, where: { status: { not: 'DISABLED' } } }),
      prisma.invoice.aggregate({ _sum: { productPrice: true },
        where: { createdAt: { gte: new Date(dayAgo * 1000) } } }),
    ]);
    await ctx.reply(`📊 آمار ربات:\n👥 کاربران: ${userCount}\n🧪 تست: ${testCount}\n💰 فروش کل: ${totalRevenue._sum.productPrice}\n📅 فروش امروز: ${dayRevenue._sum.productPrice}`);
  }
}
```

```
// لیست کامل Admin Handlers:
AdminHandlers/
├── StatisticsHandler.ts        // آمار ربات
├── PanelManagementHandler.ts   // افزودن/حذف/وضعیت پنل‌ها
├── ProductManagementHandler.ts // افزودن/حذف/ویرایش محصولات
├── UserManagementHandler.ts    // بلاک/آنبلاک، موجودی، جستجو
├── AdminManagementHandler.ts   // افزودن/حذف ادمین
├── BroadcastHandler.ts         // پیامک انبوه / فوروارد
├── TextCustomizationHandler.ts // تغییر متون ربات
├── PaymentSettingsHandler.ts   // تنظیمات درگاه پرداخت
├── ChannelHandler.ts           // مدیریت کانال اجباری
├── TestAccountHandler.ts       // تنظیمات اکانت تست
└── DiscountHandler.ts          // مدیریت کدهای تخفیف
```

### Phase 11: Additional Use Cases (هفته 10-11)

```typescript
// src/core/use-cases/ExtendService.ts
export class ExtendServiceUseCase {
  async execute(input: { userId: number; invoiceUsername: string; productId: number }) {
    const invoice = await this.invoiceRepo.findByUsername(input.invoiceUsername);
    const product = await this.productRepo.findById(input.productId);
    const user = await this.userRepo.findById(input.userId);
    if (!user.canPurchase(product.price)) return Result.fail('INSUFFICIENT_BALANCE');
    const adapter = PanelFactory.createFromName(invoice.serviceLocation);
    const newExpire = Math.max(invoice.expiresAt.getTime(), Date.now()) + product.duration * 86400000;
    await adapter.modifyUser(invoice.username, { duration: product.duration, volume: product.volume });
    user.deductBalance(product.price);
    await this.userRepo.update(user);
    return Result.success({ newExpire });
  }
}

// src/core/use-cases/ApplyDiscountCode.ts
// src/core/use-cases/RegisterAffiliate.ts
// src/core/use-cases/PurchaseExtraVolume.ts
// src/core/use-cases/RevokeSubscription.ts
```

### Phase 12: Main App Integration (هفته 11)

```typescript
// src/index.ts
import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { PanelFactory } from './infrastructure/panels/PanelFactory';
// ... imports

const prisma = new PrismaClient();
const bot = new Bot(process.env.BOT_TOKEN!);

// ── Middleware Stack ──
bot.use(rateLimiterMiddleware);
bot.use(botStatusMiddleware);
bot.use(userRegistrationMiddleware);
bot.use(userBlockCheckMiddleware);
bot.use(phoneVerificationMiddleware);
bot.use(rulesAcceptanceMiddleware);
bot.use(channelMembershipMiddleware);

// ── User Commands ──
bot.command('start', (ctx) => startHandler.handle(ctx));
bot.hears('🛒 خرید سرویس', (ctx) => purchaseHandler.showProducts(ctx));
bot.hears('📦 سرویس‌های من', (ctx) => purchaseHandler.showMyPurchases(ctx));
bot.hears('💰 کیف پول', (ctx) => walletHandler.showWallet(ctx));
bot.hears('🧪 تست رایگان', (ctx) => testHandler.handle(ctx));
bot.hears('❓ راهنما', (ctx) => helpHandler.handle(ctx));
bot.hears('👤 پروفایل', (ctx) => profileHandler.handle(ctx));
bot.hears('🎫 تیکت', (ctx) => ticketHandler.handle(ctx));

// ── Admin Commands ──
bot.hears('panel', adminMiddleware, (ctx) => adminMenuHandler.handle(ctx));

// ── Callback Queries ──
bot.callbackQuery(/^buy:(\d+)$/, (ctx) => purchaseHandler.confirmPurchase(ctx, +ctx.match[1]));
bot.callbackQuery(/^confirm:(\d+)$/, (ctx) => purchaseHandler.executePurchase(ctx, +ctx.match[1]));
bot.callbackQuery(/^extend_(.+)$/, (ctx) => extendHandler.handle(ctx, ctx.match[1]));
bot.callbackQuery('charge_wallet', (ctx) => walletHandler.showChargeOptions(ctx));
bot.callbackQuery('confirmchannel', (ctx) => channelHandler.recheck(ctx));

// ── Error Handling ──
bot.catch((err) => logger.error('Bot error', err));

// ── Start ──
bot.start();
initScheduler(); // Start cron jobs
logger.info('✅ Bot started successfully');
```

### Phase 13: Environment & Config

```env
# .env
BOT_TOKEN=your_bot_token
DATABASE_URL="mysql://user:password@localhost:3306/bot_mirza"
REDIS_URL="redis://localhost:6379"

# Marzban Panel
MARZBAN_URL=https://panel.example.com
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=password

# Payment Gateways
NOWPAYMENTS_API_KEY=your_api_key
```

```typescript
// src/shared/config/index.ts
export const config = {
  bot: {
    token: process.env.BOT_TOKEN!,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL!,
  },
  panels: {
    marzban: {
      url: process.env.MARZBAN_URL!,
      username: process.env.MARZBAN_USERNAME!,
      password: process.env.MARZBAN_PASSWORD!,
    }
  }
};
```

---

## 5. Testing Strategy

```typescript
// tests/unit/use-cases/PurchaseProduct.test.ts
import { PurchaseProductUseCase } from '../../../src/core/use-cases/PurchaseProduct';

describe('PurchaseProductUseCase', () => {
  it('should purchase product successfully', async () => {
    // Arrange
    const mockUserRepo = {
      findById: jest.fn().mockResolvedValue(/* user */),
      update: jest.fn()
    };

    const useCase = new PurchaseProductUseCase(mockUserRepo, /* ... */);

    // Act
    const result = await useCase.execute({
      userId: 1,
      productId: 1
    });

    // Assert
    expect(result.success).toBe(true);
    expect(mockUserRepo.update).toHaveBeenCalled();
  });

  it('should fail when balance insufficient', async () => {
    // Test insufficient balance scenario
  });
});
```

---

## 6. Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  bot:
    build: .
    environment:
      - BOT_TOKEN=${BOT_TOKEN}
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: bot_mirza
    volumes:
      - db_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  db_data:
  redis_data:
```

---

## 7. Monitoring & Logging

```typescript
// src/shared/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

---

## 8. Timeline کلی

**Week 1-2:** Setup + Database
**Week 3-4:** Core Logic + Use Cases
**Week 5-6:** Infrastructure (Panel APIs, Payment)
**Week 7-8:** Bot Handlers
**Week 9:** Integration + Testing
**Week 10:** Deployment + Migration

---

## 9. نکات مهم

1. **تست بنویس** - برای هر use case
2. **Validation** - ورودی‌ها رو با Zod بررسی کن
3. **Error Handling** - همه جا try-catch
4. **Logging** - همه چیز رو لاگ کن
5. **Security** - API keys رو در .env نگه دار
6. **Rate Limiting** - برای جلوگیری از spam
7. **Caching** - Redis برای session و cache

---

## 10. Resources

- [Grammy Docs](https://grammy.dev/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

این فقط شروعه. می‌تونی گام به گام پیش بری.
