import { chromium, Browser, Page } from 'playwright';
import { logger } from '../utils/logger';

interface StarlineDeviceOverview {
  alias: string;
  device_id: number;
  status: number; // 0 = offline, 1 = online
  pos?: {
    x: number; // longitude
    y: number; // latitude
    sat_qty: number;
    ts: number;
  };
  position?: {
    x: number;
    y: number;
    sat_qty: number;
    ts: number;
  };
  shared_for_me: boolean;
}

interface StarlineDeviceDetails {
  alias: string;
  device_id: number;
  pos: {
    sat_qty: number;
    ts: number;
    x: number;
    y: number;
  };
  status: number;
  position: {
    sat_qty: number;
    ts: number;
    x: number;
    y: number;
  };
  gps_lvl: number;
  gsm_lvl: number;
  battery: number;
  car_alr_state: { [key: string]: boolean };
  car_state: {
    ign: boolean; // зажигание
    run: boolean; // двигатель работает
    pbrake: boolean; // ручник
    [key: string]: any;
  };
  ctemp: number;
  functions: string[];
  fw_version: string;
  imei: string;
  phone?: string;
  sn?: string;
  ts_activity: number;
  type?: number;
  showInsuranceEvents: number;
  hideUserEvents: number;
  services: {
    control: number;
    settings: number;
  };
  mon_type: number;
}

interface StarlineAPIResponse<T> {
  result: number;
  answer: T;
}

/**
 * Persistent Starline Scraper Service
 * Держит браузер открытым постоянно для быстрого парсинга (каждую минуту)
 */
export class StarlineScraperService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;
  private isInitializing: boolean = false;
  private readonly BASE_URL = 'https://starline-online.ru';
  private readonly LOGIN_URL = `${this.BASE_URL}/`;
  private readonly username: string;
  private readonly password: string;

  constructor() {
    this.username = process.env.STARLINE_USERNAME || '';
    this.password = process.env.STARLINE_PASSWORD || '';

    if (!this.username || !this.password) {
      logger.warn('StarlineScraperService: STARLINE_USERNAME or STARLINE_PASSWORD not set. Scraper will not work.');
    }
  }

  /**
   * Инициализация: запуск браузера и логин (вызывается один раз при старте API)
   */
  async initialize(): Promise<void> {
    if (this.isInitializing) {
      logger.info('StarlineScraperService: Already initializing, waiting...');
      // Ждем завершения инициализации
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }

    if (this.isLoggedIn && this.browser && this.page) {
      logger.info('StarlineScraperService: Already initialized and logged in');
      return;
    }

    this.isInitializing = true;
    logger.info('StarlineScraperService: Initializing persistent browser session...');

    try {
      // Запускаем браузер
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      await this.page.setViewportSize({ width: 1920, height: 1080 });

      // Логинимся
      await this.login();
      this.isLoggedIn = true;
      this.isInitializing = false;

      logger.info('StarlineScraperService: ✅ Persistent browser session initialized and logged in');
    } catch (error) {
      this.isInitializing = false;
      logger.error('StarlineScraperService: Failed to initialize:', error);
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Логин в Starline
   */
  private async login(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    logger.info('StarlineScraperService: Logging in...');

    // Переходим на главную
    await this.page.goto(this.LOGIN_URL, { waitUntil: 'networkidle' });

    // Кликаем на кнопку "Вход"
    await this.page.click('a[href="#login"]');
    await this.page.waitForSelector('input[type="text"]', { timeout: 5000 });

    // Вводим логин и пароль
    await this.page.fill('input[type="text"]', this.username);
    await this.page.fill('input[type="password"]', this.password);

    // Кликаем "Войти" и ждем навигации
    await Promise.all([
      this.page.click('button[type="submit"]'),
      this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }),
    ]);

    // Проверяем что залогинились
    const currentUrl = this.page.url();
    if (currentUrl.includes('/site/map')) {
      logger.info('StarlineScraperService: ✅ Login successful');
    } else {
      throw new Error('Login failed: not redirected to map page');
    }
  }

  /**
   * Проверка здоровья браузера
   */
  async isHealthy(): Promise<boolean> {
    try {
      return !!(this.browser?.isConnected() && this.page && this.isLoggedIn);
    } catch (error) {
      return false;
    }
  }

  /**
   * Перезапуск браузера при необходимости
   */
  private async ensureHealthy(): Promise<void> {
    const healthy = await this.isHealthy();
    if (!healthy) {
      logger.warn('StarlineScraperService: Browser is not healthy, reinitializing...');
      await this.shutdown();
      await this.initialize();
    }
  }

  /**
   * Получение списка всех устройств
   */
  async getDevices(): Promise<StarlineDeviceOverview[]> {
    await this.ensureHealthy();

    if (!this.page) {
      throw new Error('Page not initialized');
    }

    logger.info('StarlineScraperService: Fetching devices list...');

    try {
      const response = await this.page.evaluate(async () => {
        const res = await fetch('/device?tz=240&_=' + Date.now(), {
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        return res.json();
      }) as StarlineAPIResponse<{ devices: StarlineDeviceOverview[] }>;

      if (response.result === 1 && response.answer && response.answer.devices) {
        logger.info(`StarlineScraperService: ✅ Fetched ${response.answer.devices.length} devices`);
        return response.answer.devices;
      }

      logger.error('StarlineScraperService: Failed to get devices. Response:', response);
      throw new Error('Failed to get Starline devices');
    } catch (error) {
      logger.error('StarlineScraperService: Error fetching devices:', error);
      throw error;
    }
  }

  /**
   * Получение детальной информации по конкретному устройству
   */
  async getDeviceDetails(deviceId: number): Promise<StarlineDeviceDetails> {
    await this.ensureHealthy();

    if (!this.page) {
      throw new Error('Page not initialized');
    }

    logger.info(`StarlineScraperService: Fetching details for device ${deviceId}...`);

    try {
      const response = await this.page.evaluate(async (id) => {
        const res = await fetch(`/device/${id}?tz=240&_=` + Date.now(), {
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        return res.json();
      }, deviceId) as StarlineAPIResponse<StarlineDeviceDetails>;

      if (response.result === 1 && response.answer) {
        return response.answer;
      }

      logger.error(`StarlineScraperService: Failed to get details for device ${deviceId}. Response:`, response);
      throw new Error(`Failed to get Starline device details for ${deviceId}`);
    } catch (error) {
      logger.error(`StarlineScraperService: Error fetching device details for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Graceful shutdown при остановке сервера
   */
  async shutdown(): Promise<void> {
    logger.info('StarlineScraperService: Shutting down...');
    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      this.isLoggedIn = false;
      logger.info('StarlineScraperService: ✅ Shutdown complete');
    } catch (error) {
      logger.error('StarlineScraperService: Error during shutdown:', error);
    }
  }
}

// Singleton instance
let scraperInstance: StarlineScraperService | null = null;

/**
 * Получить singleton instance scraper
 */
export function getStarlineScraper(): StarlineScraperService {
  if (!scraperInstance) {
    scraperInstance = new StarlineScraperService();
  }
  return scraperInstance;
}

