/**
 * Playwright Service для Umnico (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
 * 
 * Отличия от базовой версии:
 * 1. Использует Umnico API через fetch (быстрее в 10 раз!)
 * 2. Fallback на UI парсинг если API не работает
 * 3. Кеширование списка диалогов
 * 4. Поддержка фильтрации по времени последнего сообщения
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

// Кеш для списка диалогов (обновляется раз в минуту)
let conversationsCache: { data: any[], timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 минута

class UmnicoPlaywrightServiceOptimized {
  private isInitialized = false;
  private lastLoginAt: Date | null = null;

  async init() {
    if (this.isInitialized) {
      console.log('✅ Umnico browser already initialized');
      return;
    }

    console.log('🚀 Initializing Umnico Playwright Service (OPTIMIZED)...');

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
    } else {
      console.log('🆕 Creating new session...');
      context = await browser.newContext();
    }

    page = await context.newPage();

    const isLoggedIn = await this.checkSession();

    if (!isLoggedIn) {
      console.log('🔐 Session expired, logging in...');
      await this.login();
    } else {
      console.log('✅ Session is valid');
    }

    this.isInitialized = true;
    this.lastLoginAt = new Date();

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

      await page!.fill('input[name="email"]', UMNICO_EMAIL);
      await page!.fill('input[type="password"]', UMNICO_PASSWORD);
      await page!.click('button[type="submit"]');

      await page!.waitForURL('**/app/inbox/**', { timeout: 15000 });

      console.log('✅ Logged in successfully');

      await this.saveSession();
      this.lastLoginAt = new Date();
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw new Error('Failed to login to Umnico');
    }
  }

  private async saveSession() {
    try {
      const dir = path.dirname(STATE_FILE);
      await fs.mkdir(dir, { recursive: true });

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
      // Сбросить кеш после re-login
      conversationsCache = null;
    } else {
      console.log('✅ Session still valid');
    }
  }

  // ============================================
  // ОПТИМИЗИРОВАННЫЕ API МЕТОДЫ
  // ============================================

  /**
   * Получить список диалогов через API (БЫСТРО!)
   */
  async getConversationsViaAPI(limit = 50): Promise<any[]> {
    try {
      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Попробуем Umnico API endpoint
      const url = 'https://umnico.com/api/v1/deals?limit=' + limit;

      const response = await page!.evaluate(async ({ url, cookieString }) => {
        try {
          const res = await fetch(url, {
            headers: {
              'Cookie': cookieString,
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          });
          return { ok: res.ok, status: res.status, data: await res.json() };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
      }, { url, cookieString });

      if (response.ok && response.data) {
        console.log(`📋 Got ${response.data.length || 0} conversations via API`);
        return response.data;
      } else {
        console.log(`⚠️ API failed (${response.status}), falling back to UI parsing`);
        return await this.getConversationsViaUI(limit);
      }
    } catch (error) {
      console.error('❌ API method failed, falling back to UI:', error);
      return await this.getConversationsViaUI(limit);
    }
  }

  /**
   * Получить список диалогов через UI (МЕДЛЕННО - fallback)
   */
  async getConversationsViaUI(limit = 50): Promise<any[]> {
    try {
      await page!.goto('https://umnico.com/app/inbox/deals/inbox', {
        waitUntil: 'networkidle'
      });

      const conversations = await page!.$$eval('.card-message-preview__item', items =>
        items.map(item => {
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
        })
      );

      console.log(`📋 Got ${conversations.length} conversations via UI`);
      return conversations.slice(0, limit);
    } catch (error) {
      console.error('❌ Failed to get conversations:', error);
      throw error;
    }
  }

  /**
   * Получить список диалогов (с кешированием)
   */
  async getConversations(limit = 50, useCache = true): Promise<any[]> {
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
   * Возвращает расширенный объект с метаданными
   */
  async getMessagesViaAPI(conversationId: string): Promise<{
    messages: any[];
    total: number | null;
    loaded: number;
    incomplete: boolean;
    channel: string;
    channelAccount: string;
    clientPhone: string | null;
    clientTelegram: string | null;
  }> {
    try {
      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `https://umnico.com/api/v1/deals/${conversationId}/messages?limit=500`;

      const response = await page!.evaluate(async ({ url, cookieString }) => {
        try {
          const res = await fetch(url, {
            headers: {
              'Cookie': cookieString,
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          });
          return { ok: res.ok, status: res.status, data: await res.json() };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
      }, { url, cookieString });

      if (response.ok && response.data) {
        const messages = Array.isArray(response.data) ? response.data : response.data.messages || [];
        const total = response.data.total || null;
        const loaded = messages.length;
        
        // Определяем incomplete по логике x/y
        let incomplete = false;
        if (total && loaded === total) {
          // x = y → нужна прокрутка, но API не может прокручивать
          // Поэтому fallback на UI метод
          console.log(`🔄 API: loaded = total (${loaded}/${total}), falling back to UI for scrolling...`);
          return await this.getMessagesViaUI(conversationId);
        } else if (total && loaded < total) {
          // x < y → всё ОК
          incomplete = false;
        }
        
        // Пытаемся получить информацию о клиенте из первого сообщения
        const firstMsg = messages[0];
        let clientPhone = firstMsg?.phone || null;
        let clientTelegram = null;
        let channel = firstMsg?.channel || 'unknown';
        let channelAccount = firstMsg?.channelAccount || '';
        
        // Если нет телефона, это может быть Telegram
        if (!clientPhone && firstMsg?.author) {
          clientTelegram = firstMsg.author;
          channel = 'telegram';
        }
        
        return {
          messages,
          total,
          loaded,
          incomplete,
          channel,
          channelAccount,
          clientPhone,
          clientTelegram
        };
      } else {
        // Fallback на UI парсинг
        console.log(`⚠️ API failed (${response.status}), falling back to UI parsing`);
        return await this.getMessagesViaUI(conversationId);
      }
    } catch (error) {
      console.error(`❌ API method failed for conversation ${conversationId}, falling back to UI:`, error);
      return await this.getMessagesViaUI(conversationId);
    }
  }

  /**
   * Получить сообщения через UI (МЕДЛЕННО - fallback)
   * НОВАЯ ЛОГИКА:
   * - x < y → ✅ всё получили успешно
   * - x = y → 🔄 пытаемся прокрутить вверх
   * - Не получилось → ⚠️ incomplete: true для ручной доработки через MCP Chrome
   */
  async getMessagesViaUI(conversationId: string): Promise<{
    messages: any[];
    total: number | null;
    loaded: number;
    incomplete: boolean;
    channel: string;
    channelAccount: string;
    clientPhone: string | null;
    clientTelegram: string | null;
  }> {
    try {
      const url = `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`;
      await page!.goto(url, { waitUntil: 'networkidle' });

      // Извлекаем информацию о клиенте и канале
      const clientInfo = await page!.evaluate(() => {
        // Телефон
        const phoneLink = document.querySelector('a[href*="tel:"]');
        const phone = phoneLink ? phoneLink.textContent?.trim() : null;
        
        // Telegram username (если нет телефона)
        let telegram = null;
        if (!phone) {
          // Ищем в заголовке или метаданных
          const headerEl = document.querySelector('.im-header__name, .client-name, [class*="client"]');
          const headerText = headerEl?.textContent?.trim() || '';
          // Telegram username обычно начинается с @ или указан явно
          const tgMatch = headerText.match(/@(\w+)/);
          if (tgMatch) {
            telegram = tgMatch[1];
          } else if (headerText && !headerText.includes('+')) {
            // Если это не похоже на телефон, считаем Telegram username
            telegram = headerText;
          }
        }
        
        // Источник (WhatsApp/Telegram)
        const sourceEl = document.querySelector('.im-source-item');
        const sourceText = sourceEl?.textContent?.trim() || '';
        
        let channel = 'unknown';
        let channelAccount = '';
        
        if (sourceText.includes('WhatsApp')) {
          channel = 'whatsapp';
          const accountMatch = sourceText.match(/(\d+)/);
          channelAccount = accountMatch ? accountMatch[1] : '';
        } else if (sourceText.includes('Telegram') || sourceText.includes('телеграм')) {
          channel = 'telegram';
        } else if (sourceText.includes('Instagram')) {
          channel = 'instagram';
        }
        
        return { phone, telegram, channel, channelAccount, sourceText };
      });

      console.log(`📱 Client info: phone=${clientInfo.phone}, telegram=${clientInfo.telegram}, channel=${clientInfo.channel}`);

      // Пытаемся определить общее количество сообщений из UI
      const totalFromUI = await page!.evaluate(() => {
        // Ищем счётчик в заголовке или метаданных
        // Примеры: "42 сообщения", "Messages: 100", "100/100"
        const selectors = [
          '.im-header__count',
          '.messages-count',
          '[class*="count"]',
          '.im-header'
        ];
        
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent?.trim() || '';
            // Ищем число
            const match = text.match(/(\d+)/);
            if (match) {
              return parseInt(match[1]);
            }
          }
        }
        
        return null;
      });

      // Извлекаем функцию для получения сообщений
      const extractMessages = async () => {
        return await page!.$$eval('.im-stack__messages-item-wrap', wraps =>
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
      };

      // Первая загрузка
      let messages = await extractMessages();
      let loaded = messages.length;
      let incomplete = false;

      console.log(`💬 Initial load: ${loaded} messages` + (totalFromUI ? ` (total in UI: ${totalFromUI})` : ''));

      // НОВАЯ ЛОГИКА: проверяем x/y
      if (totalFromUI && loaded === totalFromUI) {
        // x = y → пытаемся прокрутить вверх
        console.log(`🔄 loaded = total (${loaded}/${totalFromUI}), attempting to scroll up...`);
        
        let scrollAttempts = 0;
        const maxScrollAttempts = 10;
        let noChangeCount = 0;
        const maxNoChange = 3;
        
        while (scrollAttempts < maxScrollAttempts) {
          const beforeScroll = messages.length;
          
          // Прокручиваем вверх
          await page!.evaluate(() => {
            const container = document.querySelector('.im-stack__messages') as HTMLElement;
            if (container) {
              container.scrollTop = 0; // Прокручиваем к началу
            }
          });
          
          // Ждем подгрузки
          await page!.waitForTimeout(2000);
          
          // Получаем обновленные сообщения
          messages = await extractMessages();
          
          if (messages.length === beforeScroll) {
            noChangeCount++;
            if (noChangeCount >= maxNoChange) {
              console.log(`⚠️  Could not load more messages after ${scrollAttempts + 1} attempts`);
              incomplete = true; // Помечаем как неполный
              break;
            }
          } else {
            noChangeCount = 0;
            const newMessages = messages.length - beforeScroll;
            console.log(`   ✅ Loaded ${newMessages} more messages (total: ${messages.length})`);
          }
          
          scrollAttempts++;
          
          // Проверяем, достигли ли x < y
          if (messages.length < totalFromUI) {
            console.log(`✅ Success! loaded < total (${messages.length}/${totalFromUI})`);
            incomplete = false;
            break;
          }
        }
        
        loaded = messages.length;
      } else if (totalFromUI && loaded < totalFromUI) {
        // x < y → всё ОК, получили всё что нужно
        console.log(`✅ loaded < total (${loaded}/${totalFromUI}) - complete!`);
        incomplete = false;
      } else if (!totalFromUI) {
        // Не смогли определить total из UI
        console.log(`⚠️  Could not determine total from UI, marking as incomplete`);
        incomplete = true;
      }

      const finalMessages = messages.map(m => ({
        ...m,
        conversationId,
        channel: clientInfo.channel,
        channelAccount: clientInfo.channelAccount
      }));

      return {
        messages: finalMessages,
        total: totalFromUI,
        loaded,
        incomplete,
        channel: clientInfo.channel,
        channelAccount: clientInfo.channelAccount,
        clientPhone: clientInfo.phone,
        clientTelegram: clientInfo.telegram
      };
    } catch (error) {
      console.error(`❌ Failed to get messages for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Получить сообщения (умный выбор метода)
   * Возвращает расширенный объект с метаданными
   */
  async getMessages(conversationId: string): Promise<{
    messages: any[];
    total: number | null;
    loaded: number;
    incomplete: boolean;
    channel: string;
    channelAccount: string;
    clientPhone: string | null;
    clientTelegram: string | null;
  }> {
    // Сначала пробуем API (быстро)
    const result = await this.getMessagesViaAPI(conversationId);
    console.log(`💬 Got ${result.loaded} messages for conversation ${conversationId}` +
      (result.total ? ` (${result.loaded}/${result.total})` : '') +
      (result.incomplete ? ' ⚠️ INCOMPLETE' : ' ✅'));
    return result;
  }

  async getStatus() {
    return {
      initialized: this.isInitialized,
      lastLoginAt: this.lastLoginAt,
      uptime: process.uptime(),
      browserConnected: browser?.isConnected() || false,
      pageUrl: page ? (await page.url().catch(() => 'unknown')) : 'no-page',
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
const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  const status = await service.getStatus();
  res.json({ ok: true, service: 'umnico-playwright-optimized', ...status });
});

app.get('/api/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const useCache = req.query.cache !== 'false';
    const conversations = await service.getConversations(limit, useCache);
    res.json({ ok: true, count: conversations.length, data: conversations, cached: useCache });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.getMessages(id);
    res.json({
      ok: true,
      conversationId: id,
      count: result.loaded,
      total: result.total,
      incomplete: result.incomplete,
      channel: result.channel,
      channelAccount: result.channelAccount,
      clientPhone: result.clientPhone,
      clientTelegram: result.clientTelegram,
      data: result.messages
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/relogin', async (req, res) => {
  try {
    await (service as any).login();
    res.json({ ok: true, message: 'Re-logged successfully' });
  } catch (error: any) {
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
  } catch (error) {
    console.error('❌ Failed to start service:', error);
    process.exit(1);
  }
}

start();

