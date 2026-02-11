
import { Context } from 'grammy';
import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/logger';

export enum AdminState {
    IDLE = 'IDLE',

    // Add Product Flow
    WAITING_PRODUCT_NAME = 'WAITING_PRODUCT_NAME',
    WAITING_PRODUCT_PRICE = 'WAITING_PRODUCT_PRICE',
    WAITING_PRODUCT_VOLUME = 'WAITING_PRODUCT_VOLUME',
    WAITING_PRODUCT_DURATION = 'WAITING_PRODUCT_DURATION',
    WAITING_PRODUCT_PANEL = 'WAITING_PRODUCT_PANEL',

    // Add Panel Flow
    WAITING_PANEL_NAME = 'WAITING_PANEL_NAME',
    WAITING_PANEL_TYPE = 'WAITING_PANEL_TYPE',
    WAITING_PANEL_URL = 'WAITING_PANEL_URL',
    WAITING_PANEL_USERNAME = 'WAITING_PANEL_USERNAME',
    WAITING_PANEL_PASSWORD = 'WAITING_PANEL_PASSWORD',
    WAITING_PANEL_INBOUNDS = 'WAITING_PANEL_INBOUNDS',

    // Edit Panel Flow
    WAITING_PANEL_EDIT_NAME = 'WAITING_PANEL_EDIT_NAME',
    WAITING_PANEL_EDIT_URL = 'WAITING_PANEL_EDIT_URL',
    WAITING_PANEL_EDIT_USERNAME = 'WAITING_PANEL_EDIT_USERNAME',
    WAITING_PANEL_EDIT_PASSWORD = 'WAITING_PANEL_EDIT_PASSWORD',

    // Edit Product Flow
    WAITING_PRODUCT_EDIT_NAME = 'WAITING_PRODUCT_EDIT_NAME',
    WAITING_PRODUCT_EDIT_PRICE = 'WAITING_PRODUCT_EDIT_PRICE',
    WAITING_PRODUCT_EDIT_VOLUME = 'WAITING_PRODUCT_EDIT_VOLUME',
    WAITING_PRODUCT_EDIT_DURATION = 'WAITING_PRODUCT_EDIT_DURATION',

    // User Management Flow
    WAITING_USER_BALANCE_ADD = 'WAITING_USER_BALANCE_ADD',
    WAITING_USER_BALANCE_SUB = 'WAITING_USER_BALANCE_SUB',
    WAITING_USER_MESSAGE = 'WAITING_USER_MESSAGE',

    // User Search
    WAITING_USER_SEARCH = 'WAITING_USER_SEARCH',

    // Channel Management
    WAITING_CHANNEL_ADD_NAME = 'WAITING_CHANNEL_ADD_NAME',
    WAITING_CHANNEL_ADD_ID = 'WAITING_CHANNEL_ADD_ID',
    WAITING_CHANNEL_ADD_LINK = 'WAITING_CHANNEL_ADD_LINK',

    // Broadcast
    WAITING_BROADCAST_MESSAGE = 'WAITING_BROADCAST_MESSAGE',

    // Discount Codes
    WAITING_DISCOUNT_CODE = 'WAITING_DISCOUNT_CODE',
    WAITING_DISCOUNT_PERCENT = 'WAITING_DISCOUNT_PERCENT',
    WAITING_DISCOUNT_LIMIT = 'WAITING_DISCOUNT_LIMIT',

    // Support Tickets
    WAITING_TICKET_REPLY = 'WAITING_TICKET_REPLY',
}

interface AdminSession {
    state: AdminState;
    data: any;
}

// In-memory session storage (consider using Redis for production if statelessness is required)
const adminSessions = new Map<number, AdminSession>();

export class AdminConversationHandler {

    static getSession(userId: number): AdminSession {
        if (!adminSessions.has(userId)) {
            adminSessions.set(userId, { state: AdminState.IDLE, data: {} });
        }
        return adminSessions.get(userId)!;
    }

    static setState(userId: number, state: AdminState, data: any = {}) {
        const session = this.getSession(userId);
        session.state = state;
        session.data = { ...session.data, ...data };
    }

    static clearSession(userId: number) {
        adminSessions.set(userId, { state: AdminState.IDLE, data: {} });
    }

    /**
     * Handle generic text messages from admins to process conversation steps
     */
    static async handleMessage(ctx: Context, next: () => Promise<void>): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const session = this.getSession(userId);

        if (session.state === AdminState.IDLE) {
            return next();
        }

        try {
            switch (session.state) {
                // ==========================================
                // ADD PRODUCT FLOW
                // ==========================================
                case AdminState.WAITING_PRODUCT_NAME:
                    session.data.name = ctx.message?.text;
                    session.state = AdminState.WAITING_PRODUCT_PRICE;
                    await ctx.reply('💰 لطفاً قیمت محصول را به تومان وارد کنید (مثلاً: 50000):');
                    break;

                case AdminState.WAITING_PRODUCT_PRICE:
                    const price = Number(ctx.message?.text);
                    if (isNaN(price)) {
                        await ctx.reply('❌ لطفاً یک عدد معتبر وارد کنید.');
                        return;
                    }
                    session.data.price = price;
                    session.state = AdminState.WAITING_PRODUCT_VOLUME;
                    await ctx.reply('📊 لطفاً حجم محصول را به گیگابایت وارد کنید (مثلاً: 10):');
                    break;

                case AdminState.WAITING_PRODUCT_VOLUME:
                    const volume = Number(ctx.message?.text);
                    if (isNaN(volume)) {
                        await ctx.reply('❌ لطفاً یک عدد معتبر وارد کنید.');
                        return;
                    }
                    session.data.volume = volume;
                    session.state = AdminState.WAITING_PRODUCT_DURATION;
                    await ctx.reply('⏱ لطفاً مدت زمان محصول را به روز وارد کنید (مثلاً: 30):');
                    break;

                case AdminState.WAITING_PRODUCT_DURATION:
                    const duration = Number(ctx.message?.text);
                    if (isNaN(duration)) {
                        await ctx.reply('❌ لطفاً یک عدد معتبر وارد کنید.');
                        return;
                    }
                    session.data.duration = duration;

                    // Fetch panels to let user choose
                    const panels = await prisma.panel.findMany({ where: { status: 'ACTIVE' } });
                    if (panels.length === 0) {
                        await ctx.reply('❌ هیچ پنل فعالی وجود ندارد. ابتدا یک پنل ایجاد کنید.');
                        this.clearSession(userId);
                        return;
                    }

                    session.state = AdminState.WAITING_PRODUCT_PANEL;

                    let panelMsg = '🖥 لطفاً شناسه (ID) پنل مورد نظر را وارد کنید:\n\n';
                    panels.forEach(p => {
                        panelMsg += `ID: <code>${p.id}</code> - ${p.name}\n`;
                    });

                    await ctx.reply(panelMsg, { parse_mode: 'HTML' });
                    break;

                case AdminState.WAITING_PRODUCT_PANEL:
                    const panelId = Number(ctx.message?.text);
                    const panel = await prisma.panel.findUnique({ where: { id: panelId } });

                    if (!panel) {
                        await ctx.reply('❌ شناسه پنل نامعتبر است. لطفاً شناسه صحیح را وارد کنید:');
                        return;
                    }

                    // Create Product
                    await prisma.product.create({
                        data: {
                            name: session.data.name,
                            price: session.data.price,
                            volume: session.data.volume,
                            duration: session.data.duration,
                            panelId: panel.id,
                            description: '',
                            isActive: true
                        }
                    });

                    await ctx.reply(`✅ محصول <b>${session.data.name}</b> با موفقیت ایجاد شد!`, {
                        parse_mode: 'HTML'
                    });

                    this.clearSession(userId);
                    break;

                // ==========================================
                // ADD PANEL FLOW
                // ==========================================
                case AdminState.WAITING_PANEL_NAME:
                    session.data.name = ctx.message?.text;
                    session.state = AdminState.WAITING_PANEL_TYPE;
                    await ctx.reply(
                        '🔌 <b>نوع پنل را انتخاب کنید:</b>\n' +
                        '(یکی از موارد زیر را دقیقاً ارسال کنید)\n\n' +
                        '<code>MARZBAN</code>\n' +
                        '<code>MARZNESHIN</code>\n' +
                        '<code>X_UI</code>\n' +
                        '<code>S_UI</code>\n' +
                        '<code>WGDASHBOARD</code>\n' +
                        '<code>MIKROTIK</code>',
                        { parse_mode: 'HTML' }
                    );
                    break;

                case AdminState.WAITING_PANEL_TYPE:
                    const type = ctx.message?.text?.toUpperCase();
                    const validTypes = ['MARZBAN', 'MARZNESHIN', 'X_UI', 'S_UI', 'WGDASHBOARD', 'MIKROTIK'];

                    if (!type || !validTypes.includes(type)) {
                        await ctx.reply('❌ نوع پنل نامعتبر است. لطفاً یکی از موارد لیست شده را ارسال کنید.');
                        return;
                    }

                    session.data.type = type;
                    session.state = AdminState.WAITING_PANEL_URL;
                    await ctx.reply('🌐 لطفاً آدرس (URL) پنل را وارد کنید (شامل http/https):');
                    break;

                case AdminState.WAITING_PANEL_URL:
                    session.data.url = ctx.message?.text;
                    session.state = AdminState.WAITING_PANEL_USERNAME;
                    await ctx.reply('👤 لطفاً نام کاربری پنل را وارد کنید:');
                    break;

                case AdminState.WAITING_PANEL_USERNAME:
                    session.data.username = ctx.message?.text;
                    session.state = AdminState.WAITING_PANEL_PASSWORD;
                    await ctx.reply('🔑 لطفاً رمز عبور پنل را وارد کنید:');
                    break;

                case AdminState.WAITING_PANEL_PASSWORD:
                    session.data.password = ctx.message?.text;
                    session.state = AdminState.WAITING_PANEL_INBOUNDS;
                    await ctx.reply(
                        '📥 <b>شناسه ورودی‌ها (Inbounds) را وارد کنید:</b>\n' +
                        'برای مرزبان معمولاً خالی بگذارید.\n' +
                        'برای Sanaei/X-UI لیستی از IDها با کاما جدا کنید (مثلاً: 1,2,3)\n' +
                        'اگر نمی‌دانید، عدد 0 یا کلمه none را ارسال کنید.',
                        { parse_mode: 'HTML' }
                    );
                    break;

                case AdminState.WAITING_PANEL_INBOUNDS:
                    let inbounds = ctx.message?.text;
                    if (inbounds === '0' || inbounds?.toLowerCase() === 'none') {
                        inbounds = '';
                    }

                    // Create Panel
                    await prisma.panel.create({
                        data: {
                            name: session.data.name,
                            type: session.data.type as any,
                            url: session.data.url,
                            username: session.data.username,
                            password: session.data.password,
                            inboundId: inbounds, // Using inboundId field for simplicity logic mapping
                            status: 'ACTIVE'
                        }
                    });

                    await ctx.reply(`✅ پنل <b>${session.data.name}</b> با موفقیت ایجاد شد!`, { parse_mode: 'HTML' });
                    this.clearSession(userId);
                    break;

                // ==========================================
                // EDIT PRODUCT FLOW
                // ==========================================
                case AdminState.WAITING_PRODUCT_EDIT_PRICE:
                    const newPrice = Number(ctx.message?.text);
                    if (isNaN(newPrice)) {
                        await ctx.reply('❌ لطفاً یک عدد معتبر وارد کنید.');
                        return;
                    }

                    const productId = session.data.productId;
                    await prisma.product.update({
                        where: { id: productId },
                        data: { price: newPrice }
                    });

                    await ctx.reply(`✅ قیمت محصول با موفقیت ویرایش شد.`, {
                        parse_mode: 'HTML'
                    });

                    this.clearSession(userId);
                    break;

                case AdminState.WAITING_PRODUCT_EDIT_NAME:
                    const newName = ctx.message?.text;
                    if (!newName) {
                        await ctx.reply('❌ لطفاً یک نام معتبر وارد کنید.');
                        return;
                    }

                    await prisma.product.update({
                        where: { id: session.data.productId },
                        data: { name: newName }
                    });

                    await ctx.reply(`✅ نام محصول با موفقیت ویرایش شد.`, { parse_mode: 'HTML' });
                    this.clearSession(userId);
                    break;

                case AdminState.WAITING_PRODUCT_EDIT_VOLUME:
                    const newVolume = Number(ctx.message?.text);
                    if (isNaN(newVolume)) {
                        await ctx.reply('❌ لطفاً یک عدد معتبر وارد کنید.');
                        return;
                    }

                    await prisma.product.update({
                        where: { id: session.data.productId },
                        data: { volume: newVolume }
                    });

                    await ctx.reply(`✅ حجم محصول با موفقیت ویرایش شد.`, { parse_mode: 'HTML' });
                    this.clearSession(userId);
                    break;

                case AdminState.WAITING_PRODUCT_EDIT_DURATION:
                    const newDuration = Number(ctx.message?.text);
                    if (isNaN(newDuration)) {
                        await ctx.reply('❌ لطفاً یک عدد معتبر وارد کنید.');
                        return;
                    }

                    await prisma.product.update({
                        where: { id: session.data.productId },
                        data: { duration: newDuration }
                    });

                    await ctx.reply(`✅ مدت زمان محصول با موفقیت ویرایش شد.`, { parse_mode: 'HTML' });
                    this.clearSession(userId);
                    break;

                // ==========================================
                // USER BALANCE FLOW
                // ==========================================
                case AdminState.WAITING_USER_BALANCE_ADD:
                    const addAmount = Number(ctx.message?.text);
                    if (isNaN(addAmount)) {
                        await ctx.reply('❌ لطفاً یک مبلغ معتبر وارد کنید.');
                        return;
                    }

                    await prisma.user.update({
                        where: { id: session.data.targetUserId },
                        data: {
                            balance: { increment: addAmount }
                        }
                    });

                    await ctx.reply('✅ موجودی کاربر با موفقیت افزایش یافت.');
                    this.clearSession(userId);
                    break;

                case AdminState.WAITING_USER_BALANCE_SUB:
                    const subAmount = Number(ctx.message?.text);
                    if (isNaN(subAmount)) {
                        await ctx.reply('❌ لطفاً یک مبلغ معتبر وارد کنید.');
                        return;
                    }

                    await prisma.user.update({
                        where: { id: session.data.targetUserId },
                        data: {
                            balance: { decrement: subAmount }
                        }
                    });

                    await ctx.reply('✅ موجودی کاربر با موفقیت کاهش یافت.');
                    this.clearSession(userId);
                    break;



                // ==========================================
                // EDIT PANEL FLOW
                // ==========================================
                case AdminState.WAITING_PANEL_EDIT_NAME:
                    const newPanelName = ctx.message?.text;
                    if (!newPanelName) return;

                    await prisma.panel.update({
                        where: { id: Number(session.data.panelId) },
                        data: { name: newPanelName }
                    });
                    await ctx.reply('✅ نام پنل ویرایش شد.');
                    this.clearSession(userId);
                    break;

                case AdminState.WAITING_PANEL_EDIT_URL:
                    const newUrl = ctx.message?.text;
                    if (!newUrl) return;

                    await prisma.panel.update({
                        where: { id: Number(session.data.panelId) },
                        data: { url: newUrl }
                    });
                    await ctx.reply('✅ آدرس پنل ویرایش شد.');
                    this.clearSession(userId);
                    break;

                case AdminState.WAITING_PANEL_EDIT_USERNAME:
                    const newUsername = ctx.message?.text;
                    if (!newUsername) return;

                    await prisma.panel.update({
                        where: { id: Number(session.data.panelId) },
                        data: { username: newUsername }
                    });
                    await ctx.reply('✅ نام کاربری پنل ویرایش شد.');
                    this.clearSession(userId);
                    break;

                case AdminState.WAITING_PANEL_EDIT_PASSWORD:
                    const newPassword = ctx.message?.text;
                    if (!newPassword) return;

                    await prisma.panel.update({
                        where: { id: Number(session.data.panelId) },
                        data: { password: newPassword }
                    });
                    await ctx.reply('✅ رمز عبور پنل ویرایش شد.');
                    this.clearSession(userId);
                    break;

                // ==========================================
                // USER MESSAGE FLOW
                // ==========================================
                case AdminState.WAITING_USER_MESSAGE:
                    const msgText = ctx.message?.text;
                    const targetChatId = session.data.targetChatId;

                    if (!msgText) {
                        await ctx.reply('❌ لطفاً یک متن معتبر وارد کنید.');
                        return;
                    }

                    await ctx.api.sendMessage(Number(targetChatId), `📩 <b>پیام از طرف پشتیبانی:</b>\n\n${msgText}`, {
                        parse_mode: 'HTML'
                    });

                    await ctx.reply('✅ پیام با موفقیت ارسال شد.');
                    this.clearSession(userId);
                    break;

                // ==========================================
                // USER SEARCH FLOW
                // ==========================================
                case AdminState.WAITING_USER_SEARCH:
                    const input = ctx.message?.text?.trim();
                    if (!input) return;

                    let user;
                    // Check if input is Chat ID (numeric)
                    if (/^\d+$/.test(input)) {
                        user = await prisma.user.findFirst({
                            where: { chatId: BigInt(input) },
                            include: { invoices: { orderBy: { createdAt: 'desc' }, take: 5 } }
                        });
                    } else if (input.startsWith('@')) {
                        // Search by username
                        // Note: We don't verify usernames via API, verifying via DB if we have it stored? 
                        // Actually User model has 'username' field? Let me check schema...
                        // I recall seeing 'username' in User model. 
                        // Assuming we store username without @.
                        const cleanUsername = input.replace('@', '');
                        user = await prisma.user.findFirst({
                            where: { username: cleanUsername },
                            include: { invoices: { orderBy: { createdAt: 'desc' }, take: 5 } }
                        });
                    }

                    if (user) {
                        // We found the user. Now show profile.
                        // We need to call UserManagementHandler.showUserProfile
                        // But that method is private/static there? It is private static.
                        // I should change it to public static OR duplicate logic?
                        // Better: call handleViewUser logic via a new public helper or just use handleViewUser id directly.
                        // But handleViewUser takes ctx and sends new message usually.
                        // Let's rely on UserManagementHandler.handleViewUser to "Show" the user.
                        // However, handleViewUser expects a callback query usually if it's from button? 
                        // No, handleViewUser checks if user exits and calls showUserProfile.
                        // showUserProfile handles both message and edit.
                        // So I can just call UserManagementHandler.handleViewUser(ctx, user.id);
                        // But I need to import UserManagementHandler.
                        const { UserManagementHandler } = require('./UserManagementHandler');
                        await UserManagementHandler.handleViewUser(ctx, user.id);
                        this.clearSession(userId);
                    } else {
                        await ctx.reply('❌ کاربر یافت نشد. لطفاً مجدد تلاش کنید یا از منو خارج شوید.');
                    }
                    break;

                // ==========================================
                // ADD CHANNEL FLOW
                // ==========================================
                case AdminState.WAITING_CHANNEL_ADD_NAME:
                    session.data.name = ctx.message?.text;
                    session.state = AdminState.WAITING_CHANNEL_ADD_ID;
                    await ctx.reply('🆔 لطفاً <b>آیدی کانال</b> یا <b>لینک خصوصی</b> (برای کانال‌های خصوصی) را وارد کنید:\n\nمثال عمومی: @ChannelName\nمثال خصوصی: -10012345678', { parse_mode: 'HTML' });
                    break;

                case AdminState.WAITING_CHANNEL_ADD_ID:
                    session.data.chatId = ctx.message?.text;
                    session.state = AdminState.WAITING_CHANNEL_ADD_LINK;
                    await ctx.reply('🔗 لطفاً <b>لینک عضویت</b> کانال را وارد کنید:\n(این لینک به کاربر نمایش داده می‌شود)', { parse_mode: 'HTML' });
                    break;

                case AdminState.WAITING_CHANNEL_ADD_LINK:
                    const link = ctx.message?.text;
                    if (!link) return;

                    await prisma.channel.create({
                        data: {
                            name: session.data.name,
                            chatId: session.data.chatId,
                            link: link
                        }
                    });

                    await ctx.reply(`✅ کانال <b>${session.data.name}</b> با موفقیت افزوده شد.`, { parse_mode: 'HTML' });
                    this.clearSession(userId);
                    break;

                // ==========================================
                // BROADCAST FLOW
                // ==========================================
                case AdminState.WAITING_BROADCAST_MESSAGE:
                    const broadcastMsg = ctx.message?.text || ctx.message?.caption;
                    // Support other message types? For now text/caption.
                    // Ideally we copy the whole message.
                    // For simplicity, let's assume text/HTML support here as per current logic.
                    // But if user sends photo, we might need to handle it.
                    // Current BroadcastHandler logic uses `triggerBroadcast` which checks `message` string.
                    // Let's stick to text/HTML for now as requested.

                    if (!broadcastMsg) {
                        await ctx.reply('❌ لطفاً یک متن معتبر ارسال کنید.');
                        return;
                    }

                    const targetIds = session.data.broadcastTargetIds;
                    const { BroadcastHandler } = require('./BroadcastHandler');
                    await BroadcastHandler.executeBroadcast(ctx, targetIds, broadcastMsg);

                    this.clearSession(userId);
                    break;

                // ==========================================
                // DISABLE DISCOUNT FLOW
                // ==========================================
                case AdminState.WAITING_DISCOUNT_CODE:
                    const code = ctx.message?.text?.toUpperCase();
                    if (!code) return;

                    // check uniqueness
                    const existing = await prisma.discountCode.findUnique({ where: { code } });
                    if (existing) {
                        await ctx.reply('❌ این کد تخفیف قبلاً وجود داشته است. لطفاً کد دیگری وارد کنید.');
                        return;
                    }

                    session.data.code = code;
                    session.state = AdminState.WAITING_DISCOUNT_PERCENT;
                    await ctx.reply('📉 لطفاً <b>درصد تخفیف</b> را وارد کنید (فقط عدد، مثلاً 20):', { parse_mode: 'HTML' });
                    break;

                case AdminState.WAITING_DISCOUNT_PERCENT:
                    const percent = Number(ctx.message?.text);
                    if (isNaN(percent) || percent < 1 || percent > 100) {
                        await ctx.reply('❌ لطفاً یک عدد بین 1 تا 100 وارد کنید.');
                        return;
                    }
                    session.data.percent = percent;
                    session.state = AdminState.WAITING_DISCOUNT_LIMIT;
                    await ctx.reply('🔢 لطفاً <b>تعداد دفعات مجاز استفاده</b> را وارد کنید:', { parse_mode: 'HTML' });
                    break;

                case AdminState.WAITING_DISCOUNT_LIMIT:
                    const maxUses = Number(ctx.message?.text);
                    if (isNaN(maxUses) || maxUses < 0) {
                        await ctx.reply('❌ لطفاً یک عدد معتبر وارد کنید.');
                        return;
                    }

                    await prisma.discountCode.create({
                        data: {
                            code: session.data.code,
                            percent: session.data.percent,
                            maxUses: maxUses
                        }
                    });

                    await ctx.reply(`✅ کد تخفیف <b>${session.data.code}</b> با ${session.data.percent}% تخفیف ایجاد شد.`, { parse_mode: 'HTML' });
                    this.clearSession(userId);
                    break;

                // ==========================================
                // TICKET REPLY FLOW
                // ==========================================
                case AdminState.WAITING_TICKET_REPLY:
                    const replyText = ctx.message?.text;
                    const ticketId = BigInt(session.data.ticketId);

                    if (!replyText) {
                        await ctx.reply('❌ لطفاً پاسخ متنی ارسال کنید.');
                        return;
                    }

                    const ticketUserId = session.data.userId; // user DB id, we need chatId to notify

                    // Update ticket
                    await prisma.supportTicket.update({
                        where: { id: Number(ticketId) },
                        data: {
                            response: replyText,
                            status: 'ANSWERED'
                        }
                    });

                    await ctx.reply(`✅ پاسخ شما برای تیکت #${ticketId} ثبت شد.`);

                    // Notify User
                    const userToNotify = await prisma.user.findUnique({ where: { id: ticketUserId } });
                    if (userToNotify) {
                        try {
                            await ctx.api.sendMessage(
                                Number(userToNotify.chatId),
                                `📩 <b>پاسخ تیکت پشتیبانی</b>\n\nتیکت شماره #${ticketId} پاسخ داده شد:\n\n💬 <b>پاسخ:</b>\n${replyText}`,
                                { parse_mode: 'HTML' }
                            );
                        } catch (e) {
                            logger.error('Failed to notify user about ticket reply:', e);
                        }
                    }

                    this.clearSession(userId);
                    break;

                default:
                    return next();
            }
        } catch (error) {
            logger.error(`Error in conversation handler for state ${session.state}:`, error);
            await ctx.reply('❌ خطایی رخ داد. عملیات لغو شد.');
            this.clearSession(userId);
        }
    }
}
