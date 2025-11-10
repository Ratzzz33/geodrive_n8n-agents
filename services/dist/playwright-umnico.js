import { chromium } from 'playwright';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
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
        browser = await chromium.launch({
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
            await fs.access(STATE_FILE);
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
            const dir = path.dirname(STATE_FILE);
            await fs.mkdir(dir, { recursive: true });
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
    async getConversations(limit = 50, getAll = false) {
        try {
            await page.goto('https://umnico.com/app/inbox/deals/inbox', {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            try {
                await page.waitForSelector('.card-message-preview__item', {
                    timeout: 10000,
                    state: 'attached'
                });
            }
            catch (e) {
                console.log('⚠️ Timeout waiting for items, continuing...');
            }
            const extractConversations = async () => {
                return await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('.card-message-preview__item'));
                    const allLinks = Array.from(document.querySelectorAll('a[href*="/details/"]'));
                    const itemToIdMap = new Map();
                    items.forEach((item, itemIndex) => {
                        let foundLink = null;
                        allLinks.forEach(link => {
                            if (link.contains(item)) {
                                foundLink = link;
                            }
                        });
                        if (!foundLink) {
                            const parent = item.parentElement;
                            if (parent) {
                                const linkInParent = parent.querySelector('a[href*="/details/"]');
                                if (linkInParent) {
                                    foundLink = linkInParent;
                                }
                            }
                        }
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
                let allConversations = await extractConversations();
                console.log(`📋 Initial conversations loaded: ${allConversations.length}`);
                console.log(`   getAll=${getAll}, limit=${limit}`);
                if (getAll) {
                    console.log(`📜 Loading ALL conversations (scrolling list)...`);
                    console.log(`   Initial count: ${allConversations.length}`);
                    let scrollAttempts = 0;
                    const maxScrollAttempts = 200;
                    let noChangeCount = 0;
                    const maxNoChange = 5;
                    while (scrollAttempts < maxScrollAttempts) {
                        const beforeScroll = allConversations.length;
                        const scrollResult = await page.evaluate(() => {
                            const selectors = [
                                '.deals-list',
                                '.inbox-list',
                                '[class*="deals-list"]',
                                '[class*="inbox-list"]',
                                '.card-message-preview',
                                '[class*="message-preview"]',
                                'main',
                                'body'
                            ];
                            let container = null;
                            let foundSelector = '';
                            for (const selector of selectors) {
                                const el = document.querySelector(selector);
                                if (el) {
                                    const style = window.getComputedStyle(el);
                                    if (style.overflowY === 'auto' || style.overflowY === 'scroll' ||
                                        el.scrollHeight > el.clientHeight) {
                                        container = el;
                                        foundSelector = selector;
                                        break;
                                    }
                                }
                            }
                            if (!container) {
                                window.scrollBy(0, 500);
                                return {
                                    container: 'window',
                                    scrollHeight: document.body.scrollHeight,
                                    currentScroll: window.scrollY,
                                    scrolled: true,
                                    canScrollMore: window.scrollY < document.body.scrollHeight - window.innerHeight - 10,
                                    actuallyScrolled: true,
                                    scrollDelta: 500
                                };
                            }
                            const currentScroll = container.scrollTop;
                            const scrollHeight = container.scrollHeight;
                            const clientHeight = container.clientHeight;
                            const scrollStep = Math.max(1000, clientHeight * 0.8);
                            const newScroll = Math.min(scrollHeight, currentScroll + scrollStep);
                            container.scrollTop = newScroll;
                            if (container.scrollTop < scrollHeight - clientHeight - 50) {
                                container.scrollTop = scrollHeight - clientHeight;
                            }
                            const actuallyScrolled = container.scrollTop > currentScroll;
                            const scrollDelta = container.scrollTop - currentScroll;
                            return {
                                container: foundSelector || 'found',
                                scrollHeight,
                                currentScroll: container.scrollTop,
                                clientHeight,
                                canScrollMore: container.scrollTop < scrollHeight - clientHeight - 10,
                                actuallyScrolled: actuallyScrolled,
                                scrollDelta: scrollDelta
                            };
                        });
                        if (scrollAttempts === 0 || scrollAttempts % 10 === 0) {
                            console.log(`   📊 Scroll attempt ${scrollAttempts + 1}: container="${scrollResult.container}", scrolled=${scrollResult.actuallyScrolled}, delta=${scrollResult.scrollDelta}, canScrollMore=${scrollResult.canScrollMore}`);
                        }
                        if (scrollResult.actuallyScrolled === false && scrollResult.container !== 'window') {
                            console.log(`   ⚠️  Scroll did not work, trying alternative methods...`);
                            try {
                                await page.keyboard.press('End');
                                await page.waitForTimeout(1000);
                                await page.evaluate(() => {
                                    const items = document.querySelectorAll('.card-message-preview__item');
                                    if (items.length > 0) {
                                        const lastItem = items[items.length - 1];
                                        lastItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                    }
                                });
                                await page.waitForTimeout(1000);
                            }
                            catch (e) {
                            }
                        }
                        await page.waitForTimeout(4000);
                        try {
                            await page.waitForFunction((prevCount) => {
                                const currentCount = document.querySelectorAll('.card-message-preview__item').length;
                                return currentCount > prevCount;
                            }, { timeout: 4000 }, beforeScroll).catch(() => {
                            });
                        }
                        catch (e) {
                        }
                        allConversations = await extractConversations();
                        if (allConversations.length === beforeScroll) {
                            noChangeCount++;
                            if (noChangeCount >= maxNoChange) {
                                console.log(`   ✅ Reached the end of conversations list (${allConversations.length} total)`);
                                break;
                            }
                        }
                        else {
                            noChangeCount = 0;
                        }
                        scrollAttempts++;
                        if (scrollAttempts % 5 === 0 || allConversations.length !== beforeScroll) {
                            console.log(`   📜 Scrolled ${scrollAttempts} times, found ${allConversations.length} conversations (was ${beforeScroll})...`);
                        }
                        if (allConversations.length > 5000) {
                            console.log(`   ⚠️  Reached 5000 conversations limit, stopping`);
                            break;
                        }
                    }
                }
                console.log(`📋 Found ${allConversations.length} conversations total`);
                if (getAll) {
                    console.log(`✅ Returning ALL ${allConversations.length} conversations (getAll=true)`);
                    return allConversations;
                }
                if (allConversations.length > 0) {
                    console.log('🔍 First 3 conversations:', JSON.stringify(allConversations.slice(0, 3), null, 2));
                }
                return allConversations.slice(0, limit);
            };
            try { }
            catch (error) {
                console.error('❌ Failed to get conversations:', error);
                throw error;
            }
        }
        finally {
        }
        async getMessages(conversationId, options) {
            try: {
                const: url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`,
                await: page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000
                }),
                await: page.waitForSelector('.im-stack__messages-item-wrap', {
                    timeout: 5000
                }).catch(() => {
                    console.log(`⚠️ No messages container for ${conversationId}`);
                }),
                const: sourceText = await page.$eval('.im-source-item', el => el.textContent?.trim() || '').catch(() => ''),
                const: channelMatch = sourceText.match(/WhatsApp.*?(\d+)/),
                let, allMessages: any[] = [],
                let, previousCount = 0,
                let, scrollAttempts = 0,
                const: maxScrollAttempts = options?.all ? 200 : 1,
                const: targetDate = options?.since || (options?.all ? new Date('2024-09-01') : undefined),
                const: extractMessages = async () => {
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
                },
                allMessages = await extractMessages(),
                previousCount = allMessages.length,
                if(options, all) { }
            } || targetDate
        };
        {
            console.log(`📜 Loading all messages for conversation ${conversationId}...`);
            let noChangeCount = 0;
            const maxNoChange = 3;
            while (scrollAttempts < maxScrollAttempts) {
                const messagesContainer = await page.$('.im-stack__messages').catch(() => null);
                if (!messagesContainer) {
                    console.log(`⚠️ Messages container not found`);
                    break;
                }
                const beforeScroll = allMessages.length;
                const scrollInfo = await page.evaluate(() => {
                    const container = document.querySelector('.im-stack__messages');
                    if (!container)
                        return { scrollTop: 0, scrollHeight: 0, clientHeight: 0, atTop: true };
                    const scrollTop = container.scrollTop;
                    const scrollHeight = container.scrollHeight;
                    const clientHeight = container.clientHeight;
                    const atTop = scrollTop <= 10;
                    return { scrollTop, scrollHeight, clientHeight, atTop };
                });
                if (scrollInfo.atTop && noChangeCount > 0) {
                    console.log(`   ✅ Already at top with no new messages (${allMessages.length} messages total)`);
                    break;
                }
                await page.evaluate(() => {
                    const container = document.querySelector('.im-stack__messages');
                    if (container) {
                        container.scrollTop = 0;
                    }
                });
                await page.waitForTimeout(2000);
                try {
                    await page.waitForFunction((prevCount) => {
                        const currentCount = document.querySelectorAll('.im-stack__messages-item-wrap').length;
                        return currentCount > prevCount;
                    }, { timeout: 2000 }, beforeScroll).catch(() => {
                    });
                }
                catch (e) {
                }
                allMessages = await extractMessages();
                if (allMessages.length === beforeScroll) {
                    noChangeCount++;
                    const isAtTop = await page.evaluate(() => {
                        const container = document.querySelector('.im-stack__messages');
                        return container ? container.scrollTop <= 10 : true;
                    });
                    if (isAtTop && noChangeCount >= maxNoChange) {
                        console.log(`   ✅ Reached the beginning of conversation (${allMessages.length} messages total)`);
                        break;
                    }
                    else if (!isAtTop) {
                        if (noChangeCount < maxNoChange) {
                            console.log(`   ⏳ Waiting for more messages to load (attempt ${noChangeCount + 1}/${maxNoChange})...`);
                            await page.waitForTimeout(2000);
                            allMessages = await extractMessages();
                            if (allMessages.length === beforeScroll) {
                                noChangeCount++;
                            }
                            else {
                                noChangeCount = 0;
                            }
                        }
                    }
                }
                else {
                    noChangeCount = 0;
                }
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
                        }
                    }
                }
                scrollAttempts++;
                if (scrollAttempts % 10 === 0) {
                    console.log(`   📜 Scrolled ${scrollAttempts} times, found ${allMessages.length} messages so far...`);
                }
                if (allMessages.length > 10000) {
                    console.log(`   ⚠️  Reached 10000 messages limit, stopping`);
                    break;
                }
            }
        }
        {
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
    catch(error) {
        console.error(`❌ Failed to get messages for conversation ${conversationId}:`, error);
        throw error;
    }
}
async;
sendMessage(conversationId, string, text, string);
Promise < void  > {
    try: {
        const: url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`,
        console, : .log(`�� Sending message to conversation ${conversationId}...`),
        await, page, : .goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 10000
        }),
        const: inputSelectors = [
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="сообщение"]',
            '.im-input__field',
            'textarea.im-input__field',
            'textarea[class*="input"]',
            'textarea'
        ],
        let, inputElement = null,
        for(, selector, of, inputSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                inputElement = await page.$(selector);
                if (inputElement) {
                    console.log(`✅ Found input field with selector: ${selector}`);
                    break;
                }
            }
            catch (e) {
                continue;
            }
        },
        if(, inputElement) {
            throw new Error('Could not find message input field');
        },
        await, inputElement, : .clear(),
        await, inputElement, : .fill(text),
        await, page, : .waitForTimeout(500),
        await, inputElement, : .press('Enter'),
        await, page, : .waitForTimeout(2000),
        const: sendButtonSelectors = [
            'button[type="submit"]',
            'button[class*="send"]',
            'button[class*="submit"]',
            '.im-input__send-button',
            'button:has-text("Отправить")',
            'button:has-text("Send")'
        ],
        const: lastMessage = await page.$$eval('.im-stack__messages-item-wrap', wraps => {
            if (wraps.length === 0)
                return null;
            const last = wraps[wraps.length - 1];
            const textEl = last.querySelector('.im-message__text');
            return textEl?.textContent?.trim() || null;
        }).catch(() => null),
        if(, lastMessage) { }
    } || !lastMessage.includes(text.substring(0, 20))
};
{
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
try { }
catch (error) {
    console.error(`❌ Failed to send message to conversation ${conversationId}:`, error);
    throw error;
}
async;
getNewMessages(conversationId, string, since ?  : Date);
Promise < any[] > {
    try: {
        const: allMessages = await this.getMessages(conversationId),
        if(, since) {
            return allMessages;
        },
        const: newMessages = allMessages.filter(m => {
            if (!m.datetime)
                return false;
            let messageDate;
            try {
                if (m.datetime.includes('T') || m.datetime.includes('-')) {
                    messageDate = new Date(m.datetime);
                }
                else {
                    const parts = m.datetime.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
                    if (parts) {
                        const [, day, month, year, hour, minute] = parts;
                        messageDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                    }
                    else {
                        messageDate = new Date(m.datetime);
                    }
                }
                if (isNaN(messageDate.getTime())) {
                    return false;
                }
                return messageDate > since;
            }
            catch (e) {
                console.warn(`⚠️ Failed to parse datetime for message: ${m.datetime}`, e);
                return false;
            }
        }),
        console, : .log(`📥 Found ${newMessages.length} new messages since ${since.toISOString()} in conversation ${conversationId}`),
        return: newMessages
    }, catch(error) {
        console.error(`❌ Failed to get new messages for conversation ${conversationId}:`, error);
        throw error;
    }
};
async;
getStatus();
{
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
async;
close();
{
    console.log('🛑 Closing Umnico Playwright Service...');
    if (browser) {
        await browser.close();
    }
    this.isInitialized = false;
}
const service = new UmnicoPlaywrightService();
const app = express();
app.use(express.json());
app.get('/health', async (req, res) => {
    const status = await service.getStatus();
    res.json({ ok: true, service: 'umnico-playwright', ...status });
});
app.get('/api/conversations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const all = req.query.all === 'true' || req.query.all === '1';
        console.log(`📥 API call: limit=${limit}, all=${all}, query.all="${req.query.all}"`);
        const conversations = await service.getConversations(all ? 10000 : limit, all);
        console.log(`📤 API response: returning ${conversations.length} conversations`);
        res.json({
            ok: true,
            count: conversations.length,
            total: conversations.length,
            data: conversations
        });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const all = req.query.all === 'true' || req.query.all === '1';
        const since = req.query.since ? new Date(req.query.since) : undefined;
        if (since && !all) {
            const messages = await service.getNewMessages(id, since);
            return res.json({ ok: true, conversationId: id, count: messages.length, data: messages });
        }
        const messages = await service.getMessages(id, { all, since });
        res.json({ ok: true, conversationId: id, count: messages.length, data: messages });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
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
app.post('/api/relogin', async (req, res) => {
    try {
        await service.login();
        res.json({ ok: true, message: 'Re-logged successfully' });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
app.get('/api/debug', async (req, res) => {
    try {
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
