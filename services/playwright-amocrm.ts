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

const PORT = process.env.AMOCRM_PLAYWRIGHT_PORT || 3002;
const STATE_FILE = process.env.AMOCRM_STATE_FILE || './data/amocrm-session.json';
const AMOCRM_EMAIL = process.env.AMOCRM_EMAIL!;
const AMOCRM_PASSWORD = process.env.AMOCRM_PASSWORD!;
const AMOCRM_SUBDOMAIN = process.env.AMOCRM_SUBDOMAIN || 'geodrive';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

class AmoCRMPlaywrightService {
  private isInitialized = false;
  private lastLoginAt: Date | null = null;
  private baseUrl = `https://${AMOCRM_SUBDOMAIN}.amocrm.ru`;

  async init() {
    if (this.isInitialized) {
      console.log('✅ AmoCRM browser already initialized');
      return;
    }

    console.log('🚀 Initializing AmoCRM Playwright Service...');

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
        const res = await fetch(`${baseUrl}/api/v4/leads/pipelines/${pipelineId}`, {
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
      const {
        pipelineId = '8580102',
        statusId,
        limit = 250,
        page = 1,
        updatedSince
      } = params;

      // Формируем query params
      const queryParams = new URLSearchParams();
      queryParams.set('filter[pipeline_id]', pipelineId);
      if (statusId) queryParams.set('filter[status_id]', statusId);
      queryParams.set('limit', limit.toString());
      queryParams.set('page', page.toString());
      if (updatedSince) {
        queryParams.set('filter[updated_at][from]', updatedSince);
      }

      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/api/v4/leads?${queryParams.toString()}`;

      const response = await page!.evaluate(async ({ url, cookieString }) => {
        const res = await fetch(url, {
          headers: {
            'Cookie': cookieString,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        return await res.json();
      }, { url, cookieString });

      const deals = response._embedded?.leads || [];
      console.log(`📋 Found ${deals.length} deals (pipeline=${pipelineId}, status=${statusId || 'all'})`);

      return {
        deals,
        total: response._total_items || deals.length,
        page: response._page || page,
        hasMore: deals.length === limit
      };
    } catch (error) {
      console.error('❌ Failed to get deals:', error);
      throw error;
    }
  }

  async getDealDetails(dealId: string): Promise<any> {
    try {
      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/api/v4/leads/${dealId}?with=contacts`;

      const response = await page!.evaluate(async ({ url, cookieString }) => {
        const res = await fetch(url, {
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
      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/api/v4/leads/${dealId}/notes`;

      const response = await page!.evaluate(async ({ url, cookieString }) => {
        const res = await fetch(url, {
          headers: {
            'Cookie': cookieString,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        return await res.json();
      }, { url, cookieString });

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
      const cookies = await context!.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const url = `${this.baseUrl}/ajax/v4/inbox/list?limit=50&order[sort_by]=last_message_at&order[sort_type]=desc`;

      const response = await page!.evaluate(async ({ url, cookieString }) => {
        const res = await fetch(url, {
          headers: {
            'Cookie': cookieString,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        return await res.json();
      }, { url, cookieString });

      const inbox = response.response?.items || [];
      console.log(`📨 Found ${inbox.length} inbox conversations`);
      return inbox;
    } catch (error) {
      console.error('❌ Failed to get inbox:', error);
      throw error;
    }
  }

  async getStatus() {
    return {
      initialized: this.isInitialized,
      lastLoginAt: this.lastLoginAt,
      uptime: process.uptime(),
      browserConnected: browser?.isConnected() || false,
      pageUrl: page ? await page.url().catch(() => 'unknown') : 'no-page',
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
      console.log(`   GET  /api/deals/:id`);
      console.log(`   GET  /api/deals/:id/notes`);
      console.log(`   GET  /api/inbox`);
      console.log(`   POST /api/relogin`);
    });
  } catch (error) {
    console.error('❌ Failed to start service:', error);
    process.exit(1);
  }
}

start();

