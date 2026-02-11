import { Bot } from 'grammy';
import { loadConfig } from './shared/config';
import { logger } from './shared/logger';
import { rateLimiterMiddleware } from './presentation/middlewares/rateLimiter';
import { userRegistrationMiddleware } from './presentation/middlewares/userRegistration';
import { userBlockCheckMiddleware } from './presentation/middlewares/userBlockCheck';
import { adminAuthMiddleware } from './presentation/middlewares/adminAuthMiddleware';

// User Handlers
import { StartHandler } from './presentation/handlers/user/StartHandler';
import { PurchaseHandler } from './presentation/handlers/user/PurchaseHandler';
import { WalletHandler } from './presentation/handlers/user/WalletHandler';

// Admin Handlers
import { AdminMenuHandler } from './presentation/handlers/admin/AdminMenuHandler';
import { StatisticsHandler } from './presentation/handlers/admin/StatisticsHandler';
import { UserManagementHandler } from './presentation/handlers/admin/UserManagementHandler';
import { PanelManagementHandler } from './presentation/handlers/admin/PanelManagementHandler';
import { ProductManagementHandler } from './presentation/handlers/admin/ProductManagementHandler';
import { BroadcastHandler } from './presentation/handlers/admin/BroadcastHandler';
import { AdminManagementHandler } from './presentation/handlers/admin/AdminManagementHandler';
import { PaymentSettingsHandler } from './presentation/handlers/admin/PaymentSettingsHandler';
import { TextCustomizationHandler } from './presentation/handlers/admin/TextCustomizationHandler';
import { ChannelHandler } from './presentation/handlers/admin/ChannelHandler';
import { DiscountHandler } from './presentation/handlers/admin/DiscountHandler';

// BullMQ Job System
import { initializeJobs, shutdownJobs } from './infrastructure/queue/JobScheduler';

import { prisma } from './infrastructure/database/prisma';

// Load configuration
const config = loadConfig();

// Create bot instance
const bot = new Bot(config.BOT_TOKEN);

// Middleware stack (order matters!)
bot.use(userRegistrationMiddleware);  // Auto-register new users
bot.use(rateLimiterMiddleware);       // Anti-spam
bot.use(userBlockCheckMiddleware);    // Block check

// Handlers
const startHandler = new StartHandler();
const purchaseHandler = new PurchaseHandler();
const walletHandler = new WalletHandler();

// ========================
// USER COMMANDS
// ========================
bot.command('start', (ctx) => startHandler.handle(ctx));
bot.command('buy', (ctx) => purchaseHandler.showProducts(ctx));
bot.command('services', (ctx) => purchaseHandler.showMyServices(ctx));
bot.command('wallet', (ctx) => walletHandler.showWallet(ctx));

// ========================
// ADMIN COMMANDS
// ========================
bot.command('admin', adminAuthMiddleware(), AdminMenuHandler.handleAdminCommand);

// ========================
// USER CALLBACK HANDLERS - Purchase
// ========================
bot.callbackQuery(/^buy:(\d+)$/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    await purchaseHandler.confirmPurchase(ctx, productId);
});

bot.callbackQuery(/^confirm:(\d+)$/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    await purchaseHandler.executePurchase(ctx, productId);
});

bot.callbackQuery('cancel', async (ctx) => {
    await ctx.editMessageText('❌ خرید لغو شد.');
    await ctx.answerCallbackQuery();
});

// ========================
// USER CALLBACK HANDLERS - Wallet
// ========================
bot.callbackQuery('wallet', (ctx) => walletHandler.showWallet(ctx));
bot.callbackQuery('charge:card', (ctx) => walletHandler.showCardToCard(ctx));

// ========================
// ADMIN CALLBACK HANDLERS - Main Menu
// ========================
bot.callbackQuery('admin:menu', adminAuthMiddleware(), AdminMenuHandler.handleAdminMenuCallback);

// ========================
// ADMIN CALLBACK HANDLERS - Statistics
// ========================
bot.callbackQuery('admin:stats', adminAuthMiddleware(), StatisticsHandler.handleStatsMenu);
bot.callbackQuery('admin:stats:users', adminAuthMiddleware(), StatisticsHandler.handleUserStats);
bot.callbackQuery('admin:stats:sales', adminAuthMiddleware(), StatisticsHandler.handleSalesStats);
bot.callbackQuery('admin:stats:services', adminAuthMiddleware(), StatisticsHandler.handleServiceStats);
bot.callbackQuery('admin:stats:panels', adminAuthMiddleware(), StatisticsHandler.handlePanelStats);

// ========================
// ADMIN CALLBACK HANDLERS - User Management
// ========================
bot.callbackQuery('admin:users', adminAuthMiddleware(), UserManagementHandler.handleUsersMenu);
// Search user - placeholder (requires conversation or text input)
// bot.callbackQuery('admin:users:search', adminAuthMiddleware(), UserManagementHandler.handleSearchUser);
bot.callbackQuery('admin:users:recent', adminAuthMiddleware(), UserManagementHandler.handleRecentUsers);
bot.callbackQuery('admin:users:blocked', adminAuthMiddleware(), UserManagementHandler.handleBlockedUsers);

bot.callbackQuery(/^admin:user:view:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const userId = parseInt(ctx.match[1]);
    await UserManagementHandler.handleViewUser(ctx, userId);
});

bot.callbackQuery(/^admin:user:ban:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const userId = parseInt(ctx.match[1]);
    await UserManagementHandler.handleBanUser(ctx, userId);
});

bot.callbackQuery(/^admin:user:unban:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const userId = parseInt(ctx.match[1]);
    await UserManagementHandler.handleUnbanUser(ctx, userId);
});

bot.callbackQuery(/^admin:user:services:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const userId = parseInt(ctx.match[1]);
    await UserManagementHandler.handleUserServices(ctx, userId);
});

// ========================
// ADMIN CALLBACK HANDLERS - Panel Management
// ========================
bot.callbackQuery('admin:panels', adminAuthMiddleware(), PanelManagementHandler.handlePanelsMenu);
// List panels - use main panels menu instead
// bot.callbackQuery('admin:panels:list', adminAuthMiddleware(), PanelManagementHandler.handleListPanels);

bot.callbackQuery(/^admin:panel:view:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const panelId = parseInt(ctx.match[1]);
    await PanelManagementHandler.handleViewPanel(ctx, panelId);
});

bot.callbackQuery(/^admin:panel:test:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const panelId = parseInt(ctx.match[1]);
    await PanelManagementHandler.handleTestPanel(ctx, panelId);
});

bot.callbackQuery(/^admin:panel:toggle:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const panelId = parseInt(ctx.match[1]);
    await PanelManagementHandler.handleTogglePanel(ctx, panelId);
});

bot.callbackQuery(/^admin:panel:delete:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const panelId = parseInt(ctx.match[1]);
    await PanelManagementHandler.handleDeletePanel(ctx, panelId);
});

// Confirm delete is handled within handleDeletePanel itself
// bot.callbackQuery(/^admin:panel:delete:confirm:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
//     const panelId = parseInt(ctx.match[1]);
//     await PanelManagementHandler.handleConfirmDelete(ctx, panelId);
// });

// ========================
// ADMIN CALLBACK HANDLERS - Product Management
// ========================
bot.callbackQuery('admin:products', adminAuthMiddleware(), ProductManagementHandler.handleProductsMenu);
// List products - use main products menu instead
// bot.callbackQuery('admin:products:list', adminAuthMiddleware(), ProductManagementHandler.handleListProducts);

bot.callbackQuery(/^admin:product:view:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    await ProductManagementHandler.handleViewProduct(ctx, productId);
});

bot.callbackQuery(/^admin:product:toggle:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    await ProductManagementHandler.handleToggleProduct(ctx, productId);
});

bot.callbackQuery(/^admin:product:delete:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    await ProductManagementHandler.handleDeleteProduct(ctx, productId);
});

// Confirm delete is handled within handleDeleteProduct itself
// bot.callbackQuery(/^admin:product:delete:confirm:(\d+)$/, adminAuthMiddleware(), async (ctx) => {
//     const productId = parseInt(ctx.match[1]);
//     await ProductManagementHandler.handleConfirmDelete(ctx, productId);
// });

// ========================
// ADMIN CALLBACK HANDLERS - Broadcast
// ========================
bot.callbackQuery('admin:broadcast', adminAuthMiddleware(), BroadcastHandler.handleBroadcastMenu);
bot.callbackQuery('admin:broadcast:all', adminAuthMiddleware(), BroadcastHandler.handleBroadcastAll);
bot.callbackQuery('admin:broadcast:active', adminAuthMiddleware(), BroadcastHandler.handleBroadcastActive);
bot.callbackQuery('admin:broadcast:inactive', adminAuthMiddleware(), BroadcastHandler.handleBroadcastInactive);

// ========================
// ADMIN CALLBACK HANDLERS - Settings
// ========================
bot.callbackQuery('admin:admins', adminAuthMiddleware(), AdminManagementHandler.handleAdminsMenu);
bot.callbackQuery('admin:payments', adminAuthMiddleware(), PaymentSettingsHandler.handlePaymentsMenu);
bot.callbackQuery('admin:payment:card', adminAuthMiddleware(), PaymentSettingsHandler.handleCardSettings);
bot.callbackQuery('admin:payment:zarinpal', adminAuthMiddleware(), PaymentSettingsHandler.handleZarinpalSettings);
bot.callbackQuery('admin:payment:crypto', adminAuthMiddleware(), PaymentSettingsHandler.handleCryptoSettings);
bot.callbackQuery('admin:texts', adminAuthMiddleware(), TextCustomizationHandler.handleTextsMenu);
bot.callbackQuery('admin:channels', adminAuthMiddleware(), ChannelHandler.handleChannelsMenu);
bot.callbackQuery('admin:discounts', adminAuthMiddleware(), DiscountHandler.handleDiscountsMenu);

// ========================
// TEXT HANDLERS (Keyboard Buttons)
// ========================
bot.hears('🛒 خرید سرویس', (ctx) => purchaseHandler.showProducts(ctx));
bot.hears('📦 سرویس‌های من', (ctx) => purchaseHandler.showMyServices(ctx));
bot.hears('💰 کیف پول', (ctx) => walletHandler.showWallet(ctx));

// ========================
// ERROR HANDLING
// ========================
bot.catch((err) => {
    logger.error('Bot error:', err);
});

// ========================
// GRACEFUL SHUTDOWN
// ========================
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

async function gracefulShutdown(signal: string) {
    logger.info(`${signal} received, shutting down gracefully...`);

    try {
        // Stop BullMQ jobs
        await shutdownJobs();

        // Stop bot
        await bot.stop();

        // Disconnect database
        await prisma.$disconnect();

        logger.info('✅ Shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// ========================
// MAIN FUNCTION
// ========================
async function main() {
    try {
        logger.info('🤖 Starting MirzaBot...');

        // Test database connection
        await prisma.$connect();
        logger.info('✅ Database connected');

        // Initialize BullMQ jobs
        await initializeJobs(bot);
        logger.info('✅ Background jobs initialized');

        // Start bot
        await bot.start({
            onStart: () => {
                logger.info('✅ Bot started successfully');
                logger.info(`📱 Bot username: @${bot.botInfo.username}`);
            },
        });
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

main();

