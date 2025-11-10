/**
 * Playwright Service для AmoCRM
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
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Загружаем .env файл
dotenv.config();

const PORT = process.env.AMOCRM_PLAYWRIGHT_PORT || 3002;
const STATE_FILE = process.env.AMOCRM_STATE_FILE || './data/amocrm-session.json';
const AMOCRM_EMAIL = process.env.AMOCRM_EMAIL || 'geodrive.ge@gmail.com';
const AMOCRM_PASSWORD = process.env.AMOCRM_PASSWORD || 'wnr3c4%UqN@jY23';
const AMOCRM_SUBDOMAIN = process.env.AMOCRM_SUBDOMAIN || 'geodrive';

// Proxy configuration
const PROXY_SERVER = process.env.AMOCRM_PROXY_SERVER || 'socks5://33pokrov33202947:eSZemNt6zrgu@j4mqjbmxfz.cn.fxdx.in:16286';
const PROXY_CHANGE_IP_URL = process.env.AMOCRM_PROXY_CHANGE_IP_URL || 'https://iproxy.online/api-rt/changeip/nenfv7s5qf/xHXCXBA4CA2N7Y5SCT7TB';
const USE_PROXY = process.env.AMOCRM_USE_PROXY !== 'false'; // По умолчанию включен

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

class AmoCRMPlaywrightService {
  private isInitialized = false;
  private lastLoginAt: Date | null = null;
  private baseUrl = `https://${AMOCRM_SUBDOMAIN}.amocrm.ru`;

  /**
   * Сменить IP через API прокси
   */
  async changeProxyIP(): Promise<void> {
    if (!USE_PROXY || !PROXY_CHANGE_IP_URL) {
      return;
    }

    try {
      console.log('🔄 Меняю IP через прокси API...');
      const response = await fetch(PROXY_CHANGE_IP_URL);
      const result = await response.json();
      
      if (result.ok === 1) {
        console.log('✅ IP изменен, жду 20 секунд...');
        await new Promise(resolve => setTimeout(resolve, 20000));
        console.log('✅ Готово к работе с новым IP');
      } else {
        console.log('⚠️ Не удалось изменить IP, продолжаю с текущим');
      }
    } catch (error) {
      console.error('❌ Ошибка смены IP:', error);
    }
  }

  async init() {
    if (this.isInitialized) {
      console.log('✅ AmoCRM browser already initialized');
      return;
    }

    console.log('🚀 Initializing AmoCRM Playwright Service...');

    // Меняем IP перед запуском (если используется прокси)
    if (USE_PROXY) {
      await this.changeProxyIP();
    }

    // Парсим прокси из строки socks5://user:pass@host:port
    // ВАЖНО: Playwright Chromium не поддерживает socks5 с аутентификацией напрямую
    // Для socks5 с auth нужно использовать HTTP прокси или переменные окружения
    let proxyConfig: { server: string; username?: string; password?: string } | undefined;
    
    if (USE_PROXY && PROXY_SERVER) {
      try {
        const proxyUrl = new URL(PROXY_SERVER);
        // Если socks5, пропускаем (Playwright не поддерживает socks5 с auth)
        if (proxyUrl.protocol === 'socks5:') {
          console.log('⚠️  Playwright не поддерживает socks5 с аутентификацией, запускаю без прокси');
          console.log('💡 Для socks5 используйте переменные окружения HTTP_PROXY/HTTPS_PROXY или HTTP прокси');
        } else {
          // Для HTTP прокси поддерживается
          const serverProtocol = proxyUrl.protocol.slice(0, -1); // убираем ':'
          proxyConfig = {
            server: `${serverProtocol}://${proxyUrl.hostname}:${proxyUrl.port}`,
            username: proxyUrl.username || undefined,
            password: proxyUrl.password || undefined
          };
          console.log(`🌐 Использую прокси: ${serverProtocol}://${proxyUrl.hostname}:${proxyUrl.port} (user: ${proxyUrl.username || 'none'})`);
        }
      } catch (error) {
        console.error('❌ Ошибка парсинга прокси, запускаю без прокси:', error);
      }
    }

    // Запускаем браузер
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      proxy: proxyConfig
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
      await page!.goto(`${this.baseUrl}/pipeline/leads`, {
        waitUntil: 'networkidle',
        timeout: 10000
      });

      // Проверяем что мы на странице воронки (не на login)
      const url = page!.url();
      return url.includes('/pipeline') || url.includes('/leads');
    } catch (error) {
      console.error('❌ Session check failed:', error);
      return false;
    }
  }

  private async login() {
    try {
      console.log('🔑 Logging into AmoCRM...');

      await page!.goto(`${this.baseUrl}/`, { waitUntil: 'networkidle' });

      // Проверяем на странице ли логина
      const isLoginPage = await page!.$('input[name="username"]').catch(() => null);

      if (isLoginPage) {
        // Заполняем форму логина
        await page!.fill('input[name="username"]', AMOCRM_EMAIL);
        await page!.fill('input[name="password"]', AMOCRM_PASSWORD);
        await page!.click('button[type="submit"]');

        // Ждем редиректа
        await page!.waitForURL('**/pipeline/**', { timeout: 15000 });
      }

      console.log('✅ Logged in successfully');

      // Сохраняем сессию
      await this.saveSession();
      this.lastLoginAt = new Date();
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw new Error('Failed to login to AmoCRM');
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

  async getPipelineStatuses(pipelineId: string = '8580102'): Promise<any> {
    try {
      // Используем REST API через браузерную сессию
      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const response = await page!.evaluate(async ({ baseUrl, pipelineId, cookieString }) => {
        const res = await (window as any).fetch(`${baseUrl}/api/v4/leads/pipelines/${pipelineId}`, {
          headers: {
            'Cookie': cookieString,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        return await res.json();
      }, { baseUrl: this.baseUrl, pipelineId, cookieString });

      console.log(`📊 Got pipeline ${pipelineId} structure`);
      return response;
    } catch (error) {
      console.error('❌ Failed to get pipeline statuses:', error);
      throw error;
    }
  }

  async getDeals(params: {
    pipelineId?: string;
    statusId?: string;
    limit?: number;
    page?: number;
    updatedSince?: string;
  } = {}): Promise<any> {
    try {
      // Проверяем сессию перед запросом
      const isSessionValid = await this.checkSession();
      if (!isSessionValid) {
        console.log('⚠️ Session invalid in getDeals, re-logging...');
        await this.login();
      }

      const {
        pipelineId = '8580102',
        statusId,
        limit = 250,
        page: pageNum = 1,
        updatedSince
      } = params;

      // Формируем query params
      // AmoCRM API v4 использует формат filter[pipelines][]=ID
      const queryParams = new URLSearchParams();
      queryParams.set('filter[pipelines][]', pipelineId);
      if (statusId) queryParams.set('filter[statuses][]', statusId);
      queryParams.set('limit', limit.toString());
      queryParams.set('page', pageNum.toString());
      if (updatedSince) {
        queryParams.set('filter[updated_at][from]', updatedSince);
      }

      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/api/v4/leads?${queryParams.toString()}`;

      const response: any = await page!.evaluate(async (args: { url: string; cookieString: string }) => {
        try {
          // Используем нативный fetch браузера
          const res = await (window as any).fetch(args.url, {
            headers: {
              'Cookie': args.cookieString,
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          });
          
          if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unable to read error');
            return { 
              error: true, 
              status: res.status, 
              statusText: res.statusText, 
              message: errorText 
            };
          }
          
          try {
            return await res.json();
          } catch (parseError: any) {
            return { 
              error: true, 
              status: 500, 
              message: `JSON parse error: ${parseError.message}` 
            };
          }
        } catch (error: any) {
          return { 
            error: true, 
            status: 500, 
            message: error.message || 'Failed to fetch' 
          };
        }
      }, { url, cookieString });

      // Проверяем на ошибку в ответе
      if (response.error) {
        throw new Error(`API error: ${response.status || 500} ${response.statusText || ''} - ${response.message}`);
      }

      // Проверяем на ошибку авторизации
      if (response.status === 401 || response.detail?.includes('Unauthorized')) {
        console.log('⚠️ 401 Unauthorized in getDeals, re-logging...');
        await this.login();
        // Повторяем запрос после перелогина
        return await this.getDeals(params);
      }

      const deals = response._embedded?.leads || [];
      console.log(`📋 Found ${deals.length} deals (pipeline=${pipelineId}, status=${statusId || 'all'})`);

      return {
        deals,
        total: response._total_items || deals.length,
        page: response._page || pageNum,
        hasMore: deals.length === limit
      };
    } catch (error) {
      console.error('❌ Failed to get deals:', error);
      // Если ошибка авторизации, пробуем перелогиниться
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        console.log('⚠️ Authorization error, attempting re-login...');
        await this.login();
        // Повторяем запрос
        return await this.getDeals(params);
      }
      throw error;
    }
  }

  async getDealDetails(dealId: string): Promise<any> {
    try {
      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/api/v4/leads/${dealId}?with=contacts`;

      const response = await page!.evaluate(async ({ url, cookieString }) => {
        const res = await (window as any).fetch(url, {
          headers: {
            'Cookie': cookieString,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        return await res.json();
      }, { url, cookieString });

      console.log(`📝 Got deal ${dealId} details`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to get deal ${dealId}:`, error);
      throw error;
    }
  }

  async getDealNotes(dealId: string): Promise<any[]> {
    try {
      // Проверяем сессию перед запросом
      const isSessionValid = await this.checkSession();
      if (!isSessionValid) {
        console.log('⚠️ Session invalid in getDealNotes, re-logging...');
        await this.login();
      }

      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/api/v4/leads/${dealId}/notes`;

      const response: any = await page!.evaluate(async (args: { url: string; cookieString: string }) => {
        try {
          const res = await (window as any).fetch(args.url, {
            headers: {
              'Cookie': args.cookieString,
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          });
          
          if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unable to read error');
            return { 
              error: true, 
              status: res.status, 
              statusText: res.statusText, 
              message: errorText 
            };
          }
          
          // Безопасный парсинг JSON
          const text = await res.text();
          if (!text || text.trim() === '') {
            return { 
              error: true, 
              status: 500, 
              message: 'Empty response from server' 
            };
          }
          
          try {
            return JSON.parse(text);
          } catch (parseError: any) {
            return { 
              error: true, 
              status: 500, 
              message: `JSON parse error: ${parseError.message}. Response: ${text.substring(0, 200)}` 
            };
          }
        } catch (error: any) {
          return { 
            error: true, 
            status: 500, 
            message: error.message || 'Unknown error' 
          };
        }
      }, { url, cookieString });

      // Проверяем на ошибку
      if (response.error) {
        throw new Error(`API error: ${response.status} ${response.statusText || ''} - ${response.message}`);
      }

      const notes = response._embedded?.notes || [];
      console.log(`💬 Found ${notes.length} notes for deal ${dealId}`);
      return notes;
    } catch (error) {
      console.error(`❌ Failed to get notes for deal ${dealId}:`, error);
      throw error;
    }
  }

  async getInboxList(): Promise<any[]> {
    try {
      // Проверяем сессию перед запросом
      const isSessionValid = await this.checkSession();
      if (!isSessionValid) {
        console.log('⚠️ Session invalid in getInboxList, re-logging...');
        await this.login();
      }

      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/ajax/v4/inbox/list?limit=50&order[sort_by]=last_message_at&order[sort_type]=desc`;

      const response: any = await page!.evaluate(async (args: { url: string; cookieString: string }) => {
        try {
          const res = await (window as any).fetch(args.url, {
            headers: {
              'Cookie': args.cookieString,
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          });
          
          if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unable to read error');
            return { 
              error: true, 
              status: res.status, 
              statusText: res.statusText, 
              message: errorText 
            };
          }
          
          // Безопасный парсинг JSON
          const text = await res.text();
          if (!text || text.trim() === '') {
            return { 
              error: true, 
              status: 500, 
              message: 'Empty response from server' 
            };
          }
          
          try {
            return JSON.parse(text);
          } catch (parseError: any) {
            return { 
              error: true, 
              status: 500, 
              message: `JSON parse error: ${parseError.message}. Response: ${text.substring(0, 200)}` 
            };
          }
        } catch (error: any) {
          return { 
            error: true, 
            status: 500, 
            message: error.message || 'Unknown error' 
          };
        }
      }, { url, cookieString });

      // Проверяем на ошибку
      if (response.error) {
        // Для inbox не критично, возвращаем пустой массив
        console.log(`⚠️ Ошибка получения inbox: ${response.status}, возвращаю пустой массив`);
        return [];
      }

      const inbox = response.response?.items || [];
      console.log(`📨 Found ${inbox.length} inbox conversations`);
      return inbox;
    } catch (error) {
      console.error('❌ Failed to get inbox:', error);
      // Не критично, возвращаем пустой массив
      return [];
    }
  }

  async getStatus() {
    return {
      initialized: this.isInitialized,
      lastLoginAt: this.lastLoginAt,
      uptime: process.uptime(),
      browserConnected: browser?.isConnected() || false,
      pageUrl: page ? page.url() : 'no-page',
      baseUrl: this.baseUrl
    };
  }

  async close() {
    console.log('🛑 Closing AmoCRM Playwright Service...');
    if (browser) {
      await browser.close();
    }
    this.isInitialized = false;
  }

  /**
   * Получить ВСЕ сделки воронки с пагинацией
   * Включает все статусы (активные и закрытые)
   */
  async getAllDeals(params: {
    pipelineId?: string;
    limit?: number;
    updatedSince?: string;
  } = {}): Promise<any[]> {
    try {
      // Проверяем сессию перед запросом
      const isSessionValid = await this.checkSession();
      if (!isSessionValid) {
        console.log('⚠️ Session invalid in getAllDeals, re-logging...');
        await this.login();
      }

      const {
        pipelineId = '8580102',
        limit = 250,
        updatedSince
      } = params;

      const allDeals: any[] = [];
      let page = 1;
      let hasMore = true;

      let retries = 0;
      const maxRetries = 3;

      while (hasMore) {
        try {
          const result = await this.getDeals({
            pipelineId,
            limit,
            page,
            updatedSince
          });

          allDeals.push(...result.deals);
          hasMore = result.hasMore && result.deals.length === limit;
          page++;
          retries = 0; // Сбрасываем счетчик при успехе

          // Задержка между страницами (увеличена для стабильности)
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error: any) {
          retries++;
          if (retries >= maxRetries) {
            console.error(`❌ Failed to get deals after ${maxRetries} retries, stopping pagination`);
            throw error;
          }
          
          // Если ошибка "Failed to fetch" или сеть, пробуем перелогиниться и сменить IP
          if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
            console.log(`⚠️ Network error on page ${page}, retry ${retries}/${maxRetries}...`);
            if (USE_PROXY) {
              await this.changeProxyIP();
            }
            await this.login(); // Перелогиниваемся
            await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем перед повтором
            // НЕ увеличиваем page, повторяем запрос для той же страницы
            continue; // Повторяем цикл
          } else {
            throw error; // Другие ошибки пробрасываем дальше
          }
        }
      }

      console.log(`�� Total deals found: ${allDeals.length} (pipeline=${pipelineId})`);
      return allDeals;
    } catch (error) {
      console.error('❌ Failed to get all deals:', error);
      throw error;
    }
  }

  /**
   * Получить детали сделки с расширенной информацией
   * Включает: контакты, custom_fields, связанные сущности
   */
  async getDealDetailsExtended(dealId: string): Promise<any> {
    try {
      // Проверяем сессию перед запросом
      const isSessionValid = await this.checkSession();
      if (!isSessionValid) {
        console.log('⚠️ Session invalid in getDealDetailsExtended, re-logging...');
        await this.login();
      }

      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Получаем детали сделки с контактами
      const url = `${this.baseUrl}/api/v4/leads/${dealId}?with=contacts`;
      
      const dealResponse: any = await page!.evaluate(async ({ url, cookieString }) => {
        try {
          const res = await (window as any).fetch(url, {
            headers: {
              'Cookie': cookieString,
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          });
          
          if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unable to read error');
            return { 
              error: true, 
              status: res.status, 
              statusText: res.statusText, 
              message: errorText 
            };
          }
          
          // Безопасный парсинг JSON
          const text = await res.text();
          if (!text || text.trim() === '') {
            return { 
              error: true, 
              status: 500, 
              message: 'Empty response from server' 
            };
          }
          
          try {
            return JSON.parse(text);
          } catch (parseError: any) {
            return { 
              error: true, 
              status: 500, 
              message: `JSON parse error: ${parseError.message}. Response: ${text.substring(0, 200)}` 
            };
          }
        } catch (error: any) {
          return { 
            error: true, 
            status: 500, 
            message: error.message || 'Unknown error' 
          };
        }
      }, { url, cookieString });

      // Проверяем на ошибку в ответе
      if (dealResponse.error) {
        // При ошибке 500 и использовании прокси - пробуем сменить IP
        if (dealResponse.status === 500 && USE_PROXY) {
          console.log('⚠️ Ошибка 500, пробую сменить IP...');
          await this.changeProxyIP();
          // Повторяем запрос после смены IP
          return await this.getDealDetailsExtended(dealId);
        }
        throw new Error(`API error: ${dealResponse.status} ${dealResponse.statusText || ''} - ${dealResponse.message}`);
      }

      // Проверяем на ошибку авторизации
      if (dealResponse.status === 401 || dealResponse.detail?.includes('Unauthorized')) {
        console.log('⚠️ 401 Unauthorized in getDealDetailsExtended, re-logging...');
        await this.login();
        // Повторяем запрос после перелогина
        return await this.getDealDetailsExtended(dealId);
      }

      const deal = dealResponse._embedded?.leads?.[0] || dealResponse;

      // Получаем примечания (с обработкой ошибок)
      let notes: any[] = [];
      try {
        notes = await this.getDealNotes(dealId);
      } catch (error) {
        console.error(`⚠️ Ошибка получения notes для сделки ${dealId}:`, error);
        // Продолжаем без notes
      }

      // Получаем inbox для поиска scope_id (с обработкой ошибок)
      let inboxItem: any = null;
      try {
        const inbox = await this.getInboxList();
        inboxItem = inbox.find((item: any) => 
          item.lead_id === String(dealId) || 
          item.entity_id === String(dealId)
        );
      } catch (error) {
        console.error(`⚠️ Ошибка получения inbox для сделки ${dealId}:`, error);
        // Продолжаем без inbox
      }

      // Извлекаем контакты из deal._embedded.contacts (если есть) или из deal._embedded.leads[0]._embedded.contacts
      let contacts: any[] = [];
      if (deal._embedded?.contacts) {
        contacts = deal._embedded.contacts;
      } else if (dealResponse._embedded?.leads?.[0]?._embedded?.contacts) {
        contacts = dealResponse._embedded.leads[0]._embedded.contacts;
      }

      return {
        deal,
        contacts,
        notes,
        scopeId: inboxItem?.scope_id || null,
        inboxItem: inboxItem || null
      };
    } catch (error) {
      console.error(`❌ Failed to get extended deal details ${dealId}:`, error);
      // Если ошибка авторизации, пробуем перелогиниться
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        console.log('⚠️ Authorization error, attempting re-login...');
        await this.login();
        // Повторяем запрос
        return await this.getDealDetailsExtended(dealId);
      }
      throw error;
    }
  }
}

// Singleton instance
const service = new AmoCRMPlaywrightService();

// Express API
const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  const status = await service.getStatus();
  res.json({ ok: true, service: 'amocrm-playwright', ...status });
});

// Get pipeline statuses
app.get('/api/pipelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pipeline = await service.getPipelineStatuses(id);
    res.json({ ok: true, data: pipeline });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get deals
app.get('/api/deals', async (req, res) => {
  try {
    const params = {
      pipelineId: req.query.pipeline_id as string,
      statusId: req.query.status_id as string,
      limit: parseInt(req.query.limit as string) || 250,
      page: parseInt(req.query.page as string) || 1,
      updatedSince: req.query.updated_since as string
    };
    const result = await service.getDeals(params);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get all deals with pagination
app.get('/api/deals/all', async (req, res) => {
  try {
    const params = {
      pipelineId: req.query.pipeline_id as string || '8580102',
      limit: parseInt(req.query.limit as string) || 250,
      updatedSince: req.query.updated_since as string
    };
    const deals = await service.getAllDeals(params);
    res.json({ ok: true, count: deals.length, deals });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get deal details
app.get('/api/deals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deal = await service.getDealDetails(id);
    res.json({ ok: true, data: deal });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get extended deal details
app.get('/api/deals/:id/extended', async (req, res) => {
  try {
    const { id } = req.params;
    const details = await service.getDealDetailsExtended(id);
    res.json({ ok: true, data: details });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get deal notes
app.get('/api/deals/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const notes = await service.getDealNotes(id);
    res.json({ ok: true, count: notes.length, data: notes });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get inbox list
app.get('/api/inbox', async (req, res) => {
  try {
    const inbox = await service.getInboxList();
    res.json({ ok: true, count: inbox.length, data: inbox });
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

// Change proxy IP
app.post('/api/change-ip', async (req, res) => {
  try {
    await (service as any).changeProxyIP();
    res.json({ ok: true, message: 'IP changed successfully' });
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
      console.log(`🚀 AmoCRM Playwright Service running on http://localhost:${PORT}`);
      console.log(`📋 API endpoints:`);
      console.log(`   GET  /health`);
      console.log(`   GET  /api/pipelines/:id`);
      console.log(`   GET  /api/deals?pipeline_id=8580102&status_id=142`);
      console.log(`   GET  /api/deals/all?pipeline_id=8580102`);
      console.log(`   GET  /api/deals/:id`);
      console.log(`   GET  /api/deals/:id/extended`);
      console.log(`   GET  /api/deals/:id/notes`);
      console.log(`   GET  /api/inbox`);
      console.log(`   POST /api/relogin`);
      console.log(`   POST /api/change-ip`);
    });
  } catch (error) {
    console.error('❌ Failed to start service:', error);
    process.exit(1);
  }
}

start();

