"use strict";
/**
 * Playwright Service для Umnico
 *
 * Постоянно работающий браузер с сохранением сессии
 * - Автологин при первом запуске
 * - Сохранение cookies в файл
 * - Автоматический re-login при истечении сессии
 * - HTTP API для n8n workflow
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
class UmnicoPlaywrightService {
    constructor() {
        this.isInitialized = false;
        this.lastLoginAt = null;
    }
    async init() {
        if (this.isInitialized) {
            console.log('✅ Umnico browser already initialized');
            return;
        }
        console.log('🚀 Initializing Umnico Playwright Service...');
        // Запускаем браузер
        browser = await playwright_1.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        // Создаем контекст с сохранением состояния
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
        // Проверяем сессию
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
        // Периодическая проверка сессии (каждые 30 минут)
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
            // Проверяем что мы на странице inbox (не на login)
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
            // Заполняем форму
            await page.fill('input[name="email"]', UMNICO_EMAIL);
            await page.fill('input[type="password"]', UMNICO_PASSWORD);
            await page.click('button[type="submit"]');
            // Ждем редиректа на inbox
            await page.waitForURL('**/app/inbox/**', { timeout: 15000 });
            console.log('✅ Logged in successfully');
            // Сохраняем сессию
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
            // Создаем директорию если не существует
            const dir = path_1.default.dirname(STATE_FILE);
            await promises_1.default.mkdir(dir, { recursive: true });
            // Сохраняем состояние контекста
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
        }
        else {
            console.log('✅ Session still valid');
        }
    }
    // API Methods для n8n
    async getConversations(limit = 50) {
        try {
            await page.goto('https://umnico.com/app/inbox/deals/inbox', {
                waitUntil: 'domcontentloaded', // Оптимизация!
                timeout: 10000
            });
            // Ждем появления списка чатов (используем более мягкий вариант)
            try {
                await page.waitForSelector('.card-message-preview__item', {
                    timeout: 10000,
                    state: 'attached' // Ждем только прикрепления к DOM, не обязательно видимости
                });
            }
            catch (e) {
                // Если не дождались, продолжаем - возможно элементы уже есть
                console.log('⚠️ Timeout waiting for items, continuing...');
            }
            // Дополнительная проверка: получаем HTML первого элемента для отладки
            const firstItemHtml = await page.$eval('.card-message-preview__item:first-child', el => el.outerHTML).catch(() => null);
            if (firstItemHtml) {
                console.log('🔍 First item HTML (first 500 chars):', firstItemHtml.substring(0, 500));
            }
            // Извлекаем список диалогов
            // Используем evaluate для более гибкой работы с DOM
            const conversations = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.card-message-preview__item'));
                const allLinks = Array.from(document.querySelectorAll('a[href*="/details/"]'));
                // Создаем карту: индекс элемента -> ID из ближайшей ссылки
                const itemToIdMap = new Map();
                items.forEach((item, itemIndex) => {
                    // Метод 1: ищем ссылку, которая содержит этот item
                    let foundLink = null;
                    allLinks.forEach(link => {
                        if (link.contains(item)) {
                            foundLink = link;
                        }
                    });
                    // Метод 2: если не нашли, ищем ссылку в том же родителе
                    if (!foundLink) {
                        const parent = item.parentElement;
                        if (parent) {
                            const linkInParent = parent.querySelector('a[href*="/details/"]');
                            if (linkInParent) {
                                foundLink = linkInParent;
                            }
                        }
                    }
                    // Метод 3: ищем ссылку среди соседей (next/previous sibling)
                    if (!foundLink) {
                        let sibling = item.previousElementSibling;
                        let maxSiblings = 5;
                        while (sibling && maxSiblings > 0 && !foundLink) {
                            const link = sibling.querySelector('a[href*="/details/"]');
                            if (link) {
                                foundLink = link;
                                break;
                            }
                            sibling = sibling.previousElementSibling;
                            maxSiblings--;
                        }
                    }
                    // Извлекаем ID из найденной ссылки
                    if (foundLink) {
                        const href = foundLink.getAttribute('href') || '';
                        const idMatch = href.match(/\/details\/(\d+)/);
                        if (idMatch && idMatch[1]) {
                            itemToIdMap.set(itemIndex, idMatch[1]);
                        }
                    }
                });
                return items.map((item, index) => {
                    const phoneEl = item.querySelector('.message-preview__user-name');
                    const lastMsgEl = item.querySelector('.message-preview__text');
                    const integrationEl = item.querySelector('.deals-integration');
                    const assignedEl = item.querySelector('.deals-cell');
                    const timestampEl = item.querySelector('.timestamp');
                    // Получаем ID из карты
                    const conversationId = itemToIdMap.get(index) || null;
                    return {
                        conversationId: conversationId,
                        phone: phoneEl?.textContent?.trim() || '',
                        lastMessage: lastMsgEl?.textContent?.trim() || '',
                        lastMessageTime: timestampEl?.textContent?.trim() || '',
                        channelAccount: integrationEl?.textContent?.trim() || '',
                        assignedTo: assignedEl?.textContent?.trim() || ''
                    };
                });
            });
            console.log(`📋 Found ${conversations.length} conversations`);
            // Отладочный вывод для первых 3 элементов
            if (conversations.length > 0) {
                console.log('🔍 First 3 conversations:', JSON.stringify(conversations.slice(0, 3), null, 2));
            }
            return conversations.slice(0, limit);
        }
        catch (error) {
            console.error('❌ Failed to get conversations:', error);
            throw error;
        }
    }
    async getMessages(conversationId, options) {
        try {
            const url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`;
            // ОПТИМИЗАЦИЯ 1: domcontentloaded вместо networkidle (в 2 раза быстрее!)
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            // ОПТИМИЗАЦИЯ 2: Ждем только появления сообщений, не всей страницы
            await page.waitForSelector('.im-stack__messages-item-wrap', {
                timeout: 5000
            }).catch(() => {
                console.log(`⚠️ No messages container for ${conversationId}`);
            });
            // Извлекаем информацию о канале (один раз)
            const sourceText = await page.$eval('.im-source-item', el => el.textContent?.trim() || '').catch(() => '');
            const channelMatch = sourceText.match(/WhatsApp.*?(\d+)/);
            let allMessages = [];
            let previousCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = options?.all ? 200 : 1; // Для всех сообщений - много попыток, для последних - 1
            const targetDate = options?.since || (options?.all ? new Date('2024-09-01') : undefined);
            // Функция извлечения сообщений
            const extractMessages = async () => {
                return await page.$$eval('.im-stack__messages-item-wrap', wraps => wraps.map((wrap, index) => {
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
            };
            // Первая загрузка
            allMessages = await extractMessages();
            previousCount = allMessages.length;
            // Если нужны все сообщения или сообщения с определенной даты - скроллим вверх
            if (options?.all || targetDate) {
                console.log(`📜 Loading all messages for conversation ${conversationId}...`);
                while (scrollAttempts < maxScrollAttempts) {
                    // Находим контейнер сообщений и скроллим вверх
                    const messagesContainer = await page.$('.im-stack__messages').catch(() => null);
                    if (!messagesContainer) {
                        console.log(`⚠️ Messages container not found`);
                        break;
                    }
                    // Сохраняем текущее количество сообщений перед скроллом
                    const beforeScroll = allMessages.length;
                    // Скроллим вверх (к началу истории)
                    await page.evaluate(() => {
                        const container = document.querySelector('.im-stack__messages');
                        if (container) {
                            container.scrollTop = 0; // Скроллим к самому верху
                        }
                    });
                    // Ждем загрузки новых сообщений (обычно 1-2 секунды)
                    await page.waitForTimeout(2000);
                    // Проверяем, загрузились ли новые сообщения
                    allMessages = await extractMessages();
                    // Если количество не изменилось - значит больше нет сообщений
                    if (allMessages.length === beforeScroll) {
                        console.log(`   ✅ Reached the beginning of conversation (${allMessages.length} messages total)`);
                        break;
                    }
                    // Проверяем, достигли ли целевой даты
                    if (targetDate) {
                        const oldestMessage = allMessages
                            .filter(m => m.datetime)
                            .sort((a, b) => {
                            try {
                                const dateA = new Date(a.datetime.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
                                const dateB = new Date(b.datetime.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
                                return dateA.getTime() - dateB.getTime();
                            }
                            catch {
                                return 0;
                            }
                        })[0];
                        if (oldestMessage) {
                            try {
                                const oldestDate = new Date(oldestMessage.datetime.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
                                if (oldestDate < targetDate) {
                                    console.log(`   ✅ Reached target date ${targetDate.toISOString().split('T')[0]} (oldest: ${oldestMessage.datetime})`);
                                    // Фильтруем только сообщения после целевой даты
                                    allMessages = allMessages.filter(m => {
                                        if (!m.datetime)
                                            return false;
                                        try {
                                            const msgDate = new Date(m.datetime.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
                                            return msgDate >= targetDate;
                                        }
                                        catch {
                                            return true;
                                        }
                                    });
                                    break;
                                }
                            }
                            catch (e) {
                                // Продолжаем если не удалось распарсить дату
                            }
                        }
                    }
                    scrollAttempts++;
                    if (scrollAttempts % 10 === 0) {
                        console.log(`   📜 Scrolled ${scrollAttempts} times, found ${allMessages.length} messages so far...`);
                    }
                    // Защита от бесконечного цикла
                    if (allMessages.length > 10000) {
                        console.log(`   ⚠️  Reached 10000 messages limit, stopping`);
                        break;
                    }
                }
            }
            else {
                // Для быстрой синхронизации - только последние 50 сообщений
                allMessages = allMessages.slice(-50);
            }
            console.log(`💬 Found ${allMessages.length} messages in conversation ${conversationId}`);
            return allMessages.map(m => ({
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
    async sendMessage(conversationId, text) {
        try {
            const url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`;
            console.log(`📤 Sending message to conversation ${conversationId}...`);
            // Открываем диалог
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            // Ждем появления поля ввода (может быть несколько вариантов селекторов)
            const inputSelectors = [
                'textarea[placeholder*="message"]',
                'textarea[placeholder*="сообщение"]',
                '.im-input__field',
                'textarea.im-input__field',
                'textarea[class*="input"]',
                'textarea'
            ];
            let inputElement = null;
            for (const selector of inputSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 3000 });
                    inputElement = await page.$(selector);
                    if (inputElement) {
                        console.log(`✅ Found input field with selector: ${selector}`);
                        break;
                    }
                }
                catch (e) {
                    // Пробуем следующий селектор
                    continue;
                }
            }
            if (!inputElement) {
                throw new Error('Could not find message input field');
            }
            // Очищаем поле и вводим текст
            await inputElement.clear();
            await inputElement.fill(text);
            // Небольшая задержка для обработки ввода
            await page.waitForTimeout(500);
            // Пробуем отправить через Enter
            await inputElement.press('Enter');
            // Ждем подтверждения отправки (появление сообщения в списке или изменение UI)
            await page.waitForTimeout(2000);
            // Альтернативный способ: поиск кнопки отправки
            const sendButtonSelectors = [
                'button[type="submit"]',
                'button[class*="send"]',
                'button[class*="submit"]',
                '.im-input__send-button',
                'button:has-text("Отправить")',
                'button:has-text("Send")'
            ];
            // Проверяем, отправилось ли сообщение (если Enter не сработал)
            const lastMessage = await page.$$eval('.im-stack__messages-item-wrap', wraps => {
                if (wraps.length === 0)
                    return null;
                const last = wraps[wraps.length - 1];
                const textEl = last.querySelector('.im-message__text');
                return textEl?.textContent?.trim() || null;
            }).catch(() => null);
            // Если сообщение не появилось, пробуем кнопку
            if (!lastMessage || !lastMessage.includes(text.substring(0, 20))) {
                for (const selector of sendButtonSelectors) {
                    try {
                        const button = await page.$(selector);
                        if (button) {
                            await button.click();
                            await page.waitForTimeout(2000);
                            console.log(`✅ Clicked send button with selector: ${selector}`);
                            break;
                        }
                    }
                    catch (e) {
                        continue;
                    }
                }
            }
            console.log(`✅ Message sent successfully to conversation ${conversationId}`);
        }
        catch (error) {
            console.error(`❌ Failed to send message to conversation ${conversationId}:`, error);
            throw error;
        }
    }
    async getNewMessages(conversationId, since) {
        try {
            // Получаем все сообщения
            const allMessages = await this.getMessages(conversationId);
            if (!since) {
                // Если since не указан, возвращаем все сообщения
                return allMessages;
            }
            // Фильтруем сообщения по времени
            const newMessages = allMessages.filter(m => {
                if (!m.datetime)
                    return false;
                // Парсим datetime (может быть в разных форматах)
                let messageDate;
                try {
                    // Пробуем разные форматы
                    if (m.datetime.includes('T') || m.datetime.includes('-')) {
                        // ISO формат
                        messageDate = new Date(m.datetime);
                    }
                    else {
                        // Формат "09.11.2025 10:40"
                        const parts = m.datetime.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
                        if (parts) {
                            const [, day, month, year, hour, minute] = parts;
                            messageDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                        }
                        else {
                            messageDate = new Date(m.datetime);
                        }
                    }
                    // Проверяем что дата валидна
                    if (isNaN(messageDate.getTime())) {
                        return false;
                    }
                    return messageDate > since;
                }
                catch (e) {
                    console.warn(`⚠️ Failed to parse datetime for message: ${m.datetime}`, e);
                    return false;
                }
            });
            console.log(`📥 Found ${newMessages.length} new messages since ${since.toISOString()} in conversation ${conversationId}`);
            return newMessages;
        }
        catch (error) {
            console.error(`❌ Failed to get new messages for conversation ${conversationId}:`, error);
            throw error;
        }
    }
    async getStatus() {
        return {
            initialized: this.isInitialized,
            lastLoginAt: this.lastLoginAt,
            uptime: process.uptime(),
            browserConnected: browser?.isConnected() || false,
            pageUrl: page ? (() => { try {
                return page.url();
            }
            catch {
                return 'unknown';
            } })() : 'no-page'
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
const service = new UmnicoPlaywrightService();
// Express API
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Health check
app.get('/health', async (req, res) => {
    const status = await service.getStatus();
    res.json({ ok: true, service: 'umnico-playwright', ...status });
});
// Get conversations list
app.get('/api/conversations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const conversations = await service.getConversations(limit);
        res.json({ ok: true, count: conversations.length, data: conversations });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
// Get messages from conversation
app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const all = req.query.all === 'true' || req.query.all === '1';
        const since = req.query.since ? new Date(req.query.since) : undefined;
        // Если указан параметр since, используем getNewMessages (быстрый метод)
        if (since && !all) {
            const messages = await service.getNewMessages(id, since);
            return res.json({ ok: true, conversationId: id, count: messages.length, data: messages });
        }
        // Иначе используем getMessages с опциями
        const messages = await service.getMessages(id, { all, since });
        res.json({ ok: true, conversationId: id, count: messages.length, data: messages });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
// Send message to conversation
app.post('/api/conversations/:id/send', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ ok: false, error: 'Text is required and must be a string' });
        }
        await service.sendMessage(id, text);
        res.json({ ok: true, conversationId: id, message: 'Message sent successfully' });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
// Force re-login
app.post('/api/relogin', async (req, res) => {
    try {
        await service.login();
        res.json({ ok: true, message: 'Re-logged successfully' });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
// Debug endpoint - возвращает HTML первого элемента и все ссылки
app.get('/api/debug', async (req, res) => {
    try {
        // page - глобальная переменная модуля
        if (!page) {
            return res.status(500).json({ ok: false, error: 'Page not initialized' });
        }
        await page.goto('https://umnico.com/app/inbox/deals/inbox', {
            waitUntil: 'domcontentloaded',
            timeout: 10000
        });
        await page.waitForSelector('.card-message-preview__item', {
            timeout: 10000,
            state: 'attached'
        });
        const debugInfo = await page.evaluate(() => {
            const firstItem = document.querySelector('.card-message-preview__item');
            const allLinks = Array.from(document.querySelectorAll('a[href*="/details/"]'));
            return {
                firstItemHtml: firstItem ? firstItem.outerHTML.substring(0, 2000) : null,
                firstItemClasses: firstItem ? firstItem.className : null,
                firstItemParent: firstItem?.parentElement ? {
                    tagName: firstItem.parentElement.tagName,
                    className: firstItem.parentElement.className,
                    href: firstItem.parentElement.tagName === 'A' ? firstItem.parentElement.getAttribute('href') : null
                } : null,
                linksCount: allLinks.length,
                linksSample: allLinks.slice(0, 5).map(link => ({
                    href: link.getAttribute('href'),
                    text: link.textContent?.trim().substring(0, 50),
                    hasItem: !!link.closest('.card-message-preview__item')
                }))
            };
        });
        res.json({ ok: true, debug: debugInfo });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
// Graceful shutdown
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
// Start service
async function start() {
    try {
        await service.init();
        app.listen(PORT, () => {
            console.log(`🚀 Umnico Playwright Service running on http://localhost:${PORT}`);
            console.log(`📋 API endpoints:`);
            console.log(`   GET  /health`);
            console.log(`   GET  /api/conversations?limit=50`);
            console.log(`   GET  /api/conversations/:id/messages?since=ISO_DATE`);
            console.log(`   POST /api/conversations/:id/send`);
            console.log(`   POST /api/relogin`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start service:', error);
        process.exit(1);
    }
}
start();
