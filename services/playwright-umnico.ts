/**
 * Playwright Service для Umnico
 * 
 * Постоянно работающий браузер с сохранением сессии
 * - Автологин при первом запуске
 * - Сохранение cookies в файл
 * - Автоматический re-login при истечении сессии
 * - HTTP API для n8n workflow
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const PORT = process.env.UMNICO_PLAYWRIGHT_PORT || 3001;
const STATE_FILE = process.env.UMNICO_STATE_FILE || './data/umnico-session.json';
const UMNICO_EMAIL = process.env.UMNICO_EMAIL!;
const UMNICO_PASSWORD = process.env.UMNICO_PASSWORD!;

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

class UmnicoPlaywrightService {
  private isInitialized = false;
  private lastLoginAt: Date | null = null;

  async init() {
    if (this.isInitialized) {
      console.log('✅ Umnico browser already initialized');
      return;
    }

    console.log('🚀 Initializing Umnico Playwright Service...');

    // Запускаем браузер
    browser = await chromium.launch({
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
    } else {
      console.log('🆕 Creating new session...');
      context = await browser.newContext();
    }

    page = await context.newPage();

    // Проверяем сессию
    const isLoggedIn = await this.checkSession();

    if (!isLoggedIn) {
      console.log('🔐 Session expired, logging in...');
      await this.login();
    } else {
      console.log('✅ Session is valid');
    }

    this.isInitialized = true;
    this.lastLoginAt = new Date();

    // Периодическая проверка сессии (каждые 30 минут)
    setInterval(() => this.checkAndRefreshSession(), 30 * 60 * 1000);
  }

  private async checkStateFile(): Promise<boolean> {
    try {
      await fs.access(STATE_FILE);
      return true;
    } catch {
      return false;
    }
  }

  private async checkSession(): Promise<boolean> {
    try {
      await page!.goto('https://umnico.com/app/inbox/deals/inbox', {
        waitUntil: 'networkidle',
        timeout: 10000
      });

      // Проверяем что мы на странице inbox (не на login)
      const url = page!.url();
      return url.includes('/app/inbox');
    } catch (error) {
      console.error('❌ Session check failed:', error);
      return false;
    }
  }

  private async login() {
    try {
      console.log('🔑 Logging into Umnico...');

      await page!.goto('https://umnico.com/login', { waitUntil: 'networkidle' });

      // Заполняем форму
      await page!.fill('input[name="email"]', UMNICO_EMAIL);
      await page!.fill('input[type="password"]', UMNICO_PASSWORD);
      await page!.click('button[type="submit"]');

      // Ждем редиректа на inbox
      await page!.waitForURL('**/app/inbox/**', { timeout: 15000 });

      console.log('✅ Logged in successfully');

      // Сохраняем сессию
      await this.saveSession();
      this.lastLoginAt = new Date();
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw new Error('Failed to login to Umnico');
    }
  }

  private async saveSession() {
    try {
      // Создаем директорию если не существует
      const dir = path.dirname(STATE_FILE);
      await fs.mkdir(dir, { recursive: true });

      // Сохраняем состояние контекста
      await context!.storageState({ path: STATE_FILE });
      console.log('💾 Session saved to', STATE_FILE);
    } catch (error) {
      console.error('❌ Failed to save session:', error);
    }
  }

  private async checkAndRefreshSession() {
    console.log('🔄 Checking session validity...');
    const isValid = await this.checkSession();

    if (!isValid) {
      console.log('⚠️ Session expired, re-logging...');
      await this.login();
    } else {
      console.log('✅ Session still valid');
    }
  }

  // API Methods для n8n

  async getConversations(limit = 50): Promise<any[]> {
    try {
      await page!.goto('https://umnico.com/app/inbox/deals/inbox', {
        waitUntil: 'domcontentloaded',  // Оптимизация!
        timeout: 10000
      });

      // Ждем появления списка чатов
      await page!.waitForSelector('.card-message-preview__item', { 
        timeout: 10000  // Увеличиваем таймаут
      });

      // Дополнительная проверка: получаем HTML первого элемента для отладки
      const firstItemHtml = await page!.$eval('.card-message-preview__item:first-child', el => el.outerHTML).catch(() => null);
      if (firstItemHtml) {
        console.log('🔍 First item HTML (first 500 chars):', firstItemHtml.substring(0, 500));
      }

      // Извлекаем список диалогов
      const conversations = await page!.$$eval('.card-message-preview__item', items =>
        items.map(item => {
          const phoneEl = item.querySelector('.message-preview__user-name');
          const lastMsgEl = item.querySelector('.message-preview__text');
          const integrationEl = item.querySelector('.deals-integration');
          const assignedEl = item.querySelector('.deals-cell');
          const timestampEl = item.querySelector('.timestamp');  // ДЛЯ СРАВНЕНИЯ!

          // Извлекаем ID из разных источников
          let conversationId = null;
          
          // 1. Из onclick атрибута
          const onclickAttr = item.getAttribute('onclick') || '';
          let idMatch = onclickAttr.match(/\/details\/(\d+)/);
          if (idMatch) {
            conversationId = idMatch[1];
          }
          
          // 2. Из data-атрибутов
          if (!conversationId) {
            conversationId = item.getAttribute('data-conversation-id') || 
                           item.getAttribute('data-id') || 
                           item.getAttribute('data-deal-id') || null;
          }
          
          // 3. Из href в ссылке внутри
          if (!conversationId) {
            const linkEl = item.querySelector('a[href*="/details/"]');
            if (linkEl) {
              const href = linkEl.getAttribute('href') || '';
              idMatch = href.match(/\/details\/(\d+)/);
              if (idMatch) {
                conversationId = idMatch[1];
              }
            }
          }
          
          // 4. Из класса или id элемента
          if (!conversationId) {
            const classList = item.className || '';
            const classMatch = classList.match(/deal-(\d+)|conversation-(\d+)/);
            if (classMatch) {
              conversationId = classMatch[1] || classMatch[2];
            }
          }

          return {
            conversationId: conversationId,
            phone: phoneEl?.textContent?.trim() || '',
            lastMessage: lastMsgEl?.textContent?.trim() || '',
            lastMessageTime: timestampEl?.textContent?.trim() || '',  // НОВОЕ!
            channelAccount: integrationEl?.textContent?.trim() || '',
            assignedTo: assignedEl?.textContent?.trim() || ''
          };
        })
      );

      console.log(`📋 Found ${conversations.length} conversations`);
      return conversations.slice(0, limit);
    } catch (error) {
      console.error('❌ Failed to get conversations:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<any[]> {
    try {
      const url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`;
      
      // ОПТИМИЗАЦИЯ 1: domcontentloaded вместо networkidle (в 2 раза быстрее!)
      await page!.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000  // Уменьшен с 30000
      });

      // ОПТИМИЗАЦИЯ 2: Ждем только появления сообщений, не всей страницы
      await page!.waitForSelector('.im-stack__messages-item-wrap', { 
        timeout: 5000 
      }).catch(() => {
        console.log(`⚠️ No messages container for ${conversationId}`);
      });

      // Извлекаем все сообщения
      const messages = await page!.$$eval('.im-stack__messages-item-wrap', wraps =>
        wraps.map((wrap, index) => {
          const messageDiv = wrap.querySelector('.im-message');
          if (!messageDiv) return null;

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
        }).filter(m => m !== null)
      );

      // Извлекаем информацию о канале
      const sourceText = await page!.$eval('.im-source-item', el => el.textContent?.trim() || '').catch(() => '');
      const channelMatch = sourceText.match(/WhatsApp.*?(\d+)/);

      // ОПТИМИЗАЦИЯ 3: Ограничить глубину - только последние 50 сообщений
      const recentMessages = messages.slice(-50);

      console.log(`💬 Found ${recentMessages.length} messages in conversation ${conversationId} (total: ${messages.length})`);

      return recentMessages.map(m => ({
        ...m,
        conversationId,
        channel: channelMatch ? 'whatsapp' : 'unknown',
        channelAccount: channelMatch ? channelMatch[1] : ''
      }));
    } catch (error) {
      console.error(`❌ Failed to get messages for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  async getStatus() {
    return {
      initialized: this.isInitialized,
      lastLoginAt: this.lastLoginAt,
      uptime: process.uptime(),
      browserConnected: browser?.isConnected() || false,
      pageUrl: page ? (() => { try { return page!.url(); } catch { return 'unknown'; } })() : 'no-page'
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
const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  const status = await service.getStatus();
  res.json({ ok: true, service: 'umnico-playwright', ...status });
});

// Get conversations list
app.get('/api/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const conversations = await service.getConversations(limit);
    res.json({ ok: true, count: conversations.length, data: conversations });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get messages from conversation
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await service.getMessages(id);
    res.json({ ok: true, conversationId: id, count: messages.length, data: messages });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Force re-login
app.post('/api/relogin', async (req, res) => {
  try {
    await (service as any).login();
    res.json({ ok: true, message: 'Re-logged successfully' });
  } catch (error: any) {
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
      console.log(`   GET  /api/conversations/:id/messages`);
      console.log(`   POST /api/relogin`);
    });
  } catch (error) {
    console.error('❌ Failed to start service:', error);
    process.exit(1);
  }
}

start();

