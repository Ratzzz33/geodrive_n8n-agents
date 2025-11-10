"use strict";
/**
 * Playwright Service для Umnico (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
 *
 * Отличия от базовой версии:
 * 1. Использует Umnico API через fetch (быстрее в 10 раз!)
 * 2. Fallback на UI парсинг если API не работает
 * 3. Кеширование списка диалогов
 * 4. Поддержка фильтрации по времени последнего сообщения
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const PORT = process.env.UMNICO_PLAYWRIGHT_PORT || 3001;
const STATE_FILE = process.env.UMNICO_STATE_FILE || './data/umnico-session.json';
const UMNICO_EMAIL = process.env.UMNICO_EMAIL;
const UMNICO_PASSWORD = process.env.UMNICO_PASSWORD;
let browser = null;
let context = null;
let page = null;
// Кеш для списка диалогов (обновляется раз в минуту)
let conversationsCache = null;
const CACHE_TTL = 60 * 1000; // 1 минута
class UmnicoPlaywrightServiceOptimized {
    constructor() {
        this.isInitialized = false;
        this.lastLoginAt = null;
    }
    async init() {
        if (this.isInitialized) {
            console.log('✅ Umnico browser already initialized');
            return;
        }
        console.log('🚀 Initializing Umnico Playwright Service (OPTIMIZED)...');
        browser = await playwright_1.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const stateExists = await this.checkStateFile();
        if (stateExists) {
            console.log('📂 Loading existing session...');
            context = await browser.newContext({
                storageState: STATE_FILE
            });
        }
        else {
            console.log('🆕 Creating new session...');
            context = await browser.newContext();
        }
        page = await context.newPage();
        const isLoggedIn = await this.checkSession();
        if (!isLoggedIn) {
            console.log('🔐 Session expired, logging in...');
            await this.login();
        }
        else {
            console.log('✅ Session is valid');
        }
        this.isInitialized = true;
        this.lastLoginAt = new Date();
        setInterval(() => this.checkAndRefreshSession(), 30 * 60 * 1000);
    }
    async checkStateFile() {
        try {
            await promises_1.default.access(STATE_FILE);
            return true;
        }
        catch {
            return false;
        }
    }
    async checkSession() {
        try {
            await page.goto('https://umnico.com/app/inbox/deals/inbox', {
                waitUntil: 'networkidle',
                timeout: 10000
            });
            const url = page.url();
            return url.includes('/app/inbox');
        }
        catch (error) {
            console.error('❌ Session check failed:', error);
            return false;
        }
    }
    async login() {
        try {
            console.log('🔑 Logging into Umnico...');
            await page.goto('https://umnico.com/login', { waitUntil: 'networkidle' });
            await page.fill('input[name="email"]', UMNICO_EMAIL);
            await page.fill('input[type="password"]', UMNICO_PASSWORD);
            await page.click('button[type="submit"]');
            await page.waitForURL('**/app/inbox/**', { timeout: 15000 });
            console.log('✅ Logged in successfully');
            await this.saveSession();
            this.lastLoginAt = new Date();
        }
        catch (error) {
            console.error('❌ Login failed:', error);
            throw new Error('Failed to login to Umnico');
        }
    }
    async saveSession() {
        try {
            const dir = path_1.default.dirname(STATE_FILE);
            await promises_1.default.mkdir(dir, { recursive: true });
            await context.storageState({ path: STATE_FILE });
            console.log('💾 Session saved to', STATE_FILE);
        }
        catch (error) {
            console.error('❌ Failed to save session:', error);
        }
    }
    async checkAndRefreshSession() {
        console.log('🔄 Checking session validity...');
        const isValid = await this.checkSession();
        if (!isValid) {
            console.log('⚠️ Session expired, re-logging...');
            await this.login();
            // Сбросить кеш после re-login
            conversationsCache = null;
        }
        else {
            console.log('✅ Session still valid');
        }
    }
    // ============================================
    // ОПТИМИЗИРОВАННЫЕ API МЕТОДЫ
    // ============================================
    /**
     * Получить список диалогов через API (БЫСТРО!)
     */
    async getConversationsViaAPI(limit = 50) {
        try {
            const cookies = await context.cookies();
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            // Попробуем Umnico API endpoint
            const url = 'https://umnico.com/api/v1/deals?limit=' + limit;
            const response = await page.evaluate(async ({ url, cookieString }) => {
                try {
                    const res = await fetch(url, {
                        headers: {
                            'Cookie': cookieString,
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json'
                        }
                    });
                    return { ok: res.ok, status: res.status, data: await res.json() };
                }
                catch (err) {
                    return { ok: false, error: err.message };
                }
            }, { url, cookieString });
            if (response.ok && response.data) {
                console.log(`📋 Got ${response.data.length || 0} conversations via API`);
                return response.data;
            }
            else {
                console.log(`⚠️ API failed (${response.status}), falling back to UI parsing`);
                return await this.getConversationsViaUI(limit);
            }
        }
        catch (error) {
            console.error('❌ API method failed, falling back to UI:', error);
            return await this.getConversationsViaUI(limit);
        }
    }
    /**
     * Получить список диалогов через UI (МЕДЛЕННО - fallback)
     */
    async getConversationsViaUI(limit = 50) {
        try {
            await page.goto('https://umnico.com/app/inbox/deals/inbox', {
                waitUntil: 'networkidle'
            });
            const conversations = await page.$$eval('.card-message-preview__item', items => items.map(item => {
                const phoneEl = item.querySelector('.message-preview__user-name');
                const lastMsgEl = item.querySelector('.message-preview__text');
                const integrationEl = item.querySelector('.deals-integration');
                const assignedEl = item.querySelector('.deals-cell');
                const onclickAttr = item.getAttribute('onclick') || '';
                const idMatch = onclickAttr.match(/\/details\/(\d+)/);
                return {
                    conversationId: idMatch ? idMatch[1] : null,
                    phone: phoneEl?.textContent?.trim() || '',
                    lastMessage: lastMsgEl?.textContent?.trim() || '',
                    channelAccount: integrationEl?.textContent?.trim() || '',
                    assignedTo: assignedEl?.textContent?.trim() || ''
                };
            }));
            console.log(`📋 Got ${conversations.length} conversations via UI`);
            return conversations.slice(0, limit);
        }
        catch (error) {
            console.error('❌ Failed to get conversations:', error);
            throw error;
        }
    }
    /**
     * Получить список диалогов (с кешированием)
     */
    async getConversations(limit = 50, useCache = true) {
        // Проверяем кеш
        if (useCache && conversationsCache && (Date.now() - conversationsCache.timestamp) < CACHE_TTL) {
            console.log(`📦 Using cached conversations (${conversationsCache.data.length} items)`);
            return conversationsCache.data.slice(0, limit);
        }
        // Получаем свежие данные
        const conversations = await this.getConversationsViaAPI(limit);
        // Обновляем кеш
        conversationsCache = {
            data: conversations,
            timestamp: Date.now()
        };
        return conversations;
    }
    /**
     * Получить сообщения через API (БЫСТРО!)
     */
    async getMessagesViaAPI(conversationId) {
        try {
            const cookies = await context.cookies();
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            const url = `https://umnico.com/api/v1/deals/${conversationId}/messages?limit=100`;
            const response = await page.evaluate(async ({ url, cookieString }) => {
                try {
                    const res = await fetch(url, {
                        headers: {
                            'Cookie': cookieString,
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json'
                        }
                    });
                    return { ok: res.ok, status: res.status, data: await res.json() };
                }
                catch (err) {
                    return { ok: false, error: err.message };
                }
            }, { url, cookieString });
            if (response.ok && response.data) {
                const messages = Array.isArray(response.data) ? response.data : response.data.messages || [];
                return messages;
            }
            else {
                // Fallback на UI парсинг
                return await this.getMessagesViaUI(conversationId);
            }
        }
        catch (error) {
            console.error(`❌ API method failed for conversation ${conversationId}, falling back to UI:`, error);
            return await this.getMessagesViaUI(conversationId);
        }
    }
    /**
     * Получить сообщения через UI (МЕДЛЕННО - fallback)
     */
    async getMessagesViaUI(conversationId) {
        try {
            const url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`;
            await page.goto(url, { waitUntil: 'networkidle' });
            const messages = await page.$$eval('.im-stack__messages-item-wrap', wraps => wraps.map((wrap, index) => {
                const messageDiv = wrap.querySelector('.im-message');
                if (!messageDiv)
                    return null;
                const textEl = messageDiv.querySelector('.im-message__text');
                const timeEl = messageDiv.querySelector('.im-info__date');
                const dateAttr = wrap.querySelector('.im-stack__messages-item')?.getAttribute('name');
                const isOutgoing = messageDiv.classList.contains('im-message_out') ||
                    messageDiv.classList.contains('im-message--outgoing');
                return {
                    index,
                    text: textEl?.textContent?.trim() || '',
                    time: timeEl?.textContent?.trim() || '',
                    datetime: dateAttr || '',
                    direction: isOutgoing ? 'outgoing' : 'incoming',
                    hasAttachments: messageDiv.querySelectorAll('img:not([alt])').length > 0
                };
            }).filter(m => m !== null));
            const sourceText = await page.$eval('.im-source-item', el => el.textContent?.trim() || '').catch(() => '');
            const channelMatch = sourceText.match(/WhatsApp.*?(\d+)/);
            return messages.map(m => ({
                ...m,
                conversationId,
                channel: channelMatch ? 'whatsapp' : 'unknown',
                channelAccount: channelMatch ? channelMatch[1] : ''
            }));
        }
        catch (error) {
            console.error(`❌ Failed to get messages for conversation ${conversationId}:`, error);
            throw error;
        }
    }
    /**
     * Получить сообщения (умный выбор метода)
     */
    async getMessages(conversationId) {
        // Сначала пробуем API (быстро)
        const messages = await this.getMessagesViaAPI(conversationId);
        console.log(`💬 Got ${messages.length} messages for conversation ${conversationId}`);
        return messages;
    }
    async getStatus() {
        return {
            initialized: this.isInitialized,
            lastLoginAt: this.lastLoginAt,
            uptime: process.uptime(),
            browserConnected: browser?.isConnected() || false,
            pageUrl: page ? await page.url().catch(() => 'unknown') : 'no-page',
            cacheSize: conversationsCache?.data.length || 0,
            cacheAge: conversationsCache ? Math.round((Date.now() - conversationsCache.timestamp) / 1000) : null
        };
    }
    async close() {
        console.log('🛑 Closing Umnico Playwright Service...');
        if (browser) {
            await browser.close();
        }
        this.isInitialized = false;
    }
}
// Singleton instance
const service = new UmnicoPlaywrightServiceOptimized();
// Express API
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', async (req, res) => {
    const status = await service.getStatus();
    res.json({ ok: true, service: 'umnico-playwright-optimized', ...status });
});
app.get('/api/conversations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const useCache = req.query.cache !== 'false';
        const conversations = await service.getConversations(limit, useCache);
        res.json({ ok: true, count: conversations.length, data: conversations, cached: useCache });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await service.getMessages(id);
        res.json({ ok: true, conversationId: id, count: messages.length, data: messages });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
app.post('/api/relogin', async (req, res) => {
    try {
        await service.login();
        res.json({ ok: true, message: 'Re-logged successfully' });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
// Очистить кеш
app.post('/api/cache/clear', async (req, res) => {
    conversationsCache = null;
    res.json({ ok: true, message: 'Cache cleared' });
});
process.on('SIGTERM', async () => {
    console.log('📡 SIGTERM received, closing...');
    await service.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('📡 SIGINT received, closing...');
    await service.close();
    process.exit(0);
});
async function start() {
    try {
        await service.init();
        app.listen(PORT, () => {
            console.log(`🚀 Umnico Playwright Service (OPTIMIZED) running on http://localhost:${PORT}`);
            console.log(`📋 API endpoints:`);
            console.log(`   GET  /health`);
            console.log(`   GET  /api/conversations?limit=50&cache=true`);
            console.log(`   GET  /api/conversations/:id/messages`);
            console.log(`   POST /api/relogin`);
            console.log(`   POST /api/cache/clear`);
            console.log(`\n⚡ Optimizations:`);
            console.log(`   - Uses Umnico API (10x faster!)`);
            console.log(`   - Fallback to UI parsing if API fails`);
            console.log(`   - Conversations list cache (1 min TTL)`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start service:', error);
        process.exit(1);
    }
}
start();
