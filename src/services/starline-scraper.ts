import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../utils/logger.js';

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
  pos?: {
    sat_qty: number;
    ts: number;
    x: number;
    y: number;
    speed?: number; // скорость в км/ч
  };
  status: number;
  position?: {
    sat_qty: number;
    ts: number;
    x: number;
    y: number;
    dir?: number;
    speed?: number; // скорость в км/ч
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
  private context: BrowserContext | null = null;
  private contextWithProxy: BrowserContext | null = null;  // Временный контекст с прокси для логина
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
  /**
   * Генерация случайного fingerprint браузера для обхода защиты от DDoS
   */
  private generateBrowserFingerprint() {
    // Базовый fingerprint из реального браузера (MCP Chrome)
    const baseFingerprint = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'ru-RU',
      timezoneId: 'Asia/Tbilisi',
      platform: 'Win32',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      colorDepth: 24,
    };

    // Добавляем небольшие случайные вариации для уникальности
    const viewportVariations = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
    ];
    
    const randomViewport = viewportVariations[Math.floor(Math.random() * viewportVariations.length)];
    
    // Случайные версии Chrome (реалистичные)
    const chromeVersions = ['142.0.0.0', '141.0.0.0', '140.0.0.0', '139.0.0.0'];
    const randomVersion = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    
    return {
      userAgent: baseFingerprint.userAgent.replace('142.0.0.0', randomVersion),
      viewport: randomViewport,
      locale: baseFingerprint.locale,
      timezoneId: baseFingerprint.timezoneId,
      platform: baseFingerprint.platform,
      hardwareConcurrency: baseFingerprint.hardwareConcurrency,
      deviceMemory: baseFingerprint.deviceMemory,
      colorDepth: baseFingerprint.colorDepth,
    };
  }

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
      // Используем реальный User-Agent из обычного Chrome браузера
      const realUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      const viewport = { width: 1920, height: 1080 };
      
      logger.info(`StarlineScraperService: Using REAL User-Agent with HTTP proxy`);
      logger.info(`StarlineScraperService: UA: ${realUserAgent.substring(0, 60)}...`);
      logger.info(`StarlineScraperService: Viewport: ${viewport.width}x${viewport.height}`);

      // Запускаем браузер в headless режиме
      // HTTP прокси + реальный User-Agent достаточно для обхода защиты Starline
      this.browser = await chromium.launch({
        headless: true,  // ✅ Headless режим + прокси + реальный UA = работает!
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          // Дополнительные аргументы для обхода детекции
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });

      // Создаем ВРЕМЕННЫЙ контекст с HTTP прокси для логина (обход DDoS защиты)
      logger.info('StarlineScraperService: 🔐 Creating temporary context with HTTP proxy for login...');
      logger.info('StarlineScraperService: 🔐 Proxy server: http://j4mqjbmxfz.cn.fxdx.in:16285');
      this.contextWithProxy = await this.browser.newContext({
        // HTTP прокси для обхода блокировок (Playwright поддерживает HTTP с авторизацией)
        proxy: {
          server: 'http://j4mqjbmxfz.cn.fxdx.in:16285',
          username: '33pokrov33202941',
          password: 'IAzLy13QUvwf',
        },
        // Реальный User-Agent из Chrome
        userAgent: realUserAgent,
        viewport: viewport,
        locale: 'ru-RU',
        timezoneId: 'Asia/Tbilisi',
        // Реалистичные заголовки
        extraHTTPHeaders: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
        },
        permissions: ['geolocation'],
        // Полностью чистый профиль - новая сессия
        storageState: undefined,
      });

      // Используем контекст с прокси для логина
      this.context = this.contextWithProxy;

      // Переопределяем navigator свойства через CDP для более реалистичного fingerprint
      await this.context.addInitScript(() => {
        // Переопределяем navigator.platform
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32',
        });
        
        // Переопределяем navigator.hardwareConcurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8,
        });
        
        // Переопределяем navigator.deviceMemory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
        });
        
        // Скрываем webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Переопределяем chrome
        (window as any).chrome = {
          runtime: {},
        };
      });

      this.page = await this.context.newPage();

      // Очищаем куки через Playwright API (до загрузки страницы)
      await this.context.clearCookies();
      logger.info('StarlineScraperService: ✅ Cookies cleared via Playwright API');

      // Логинимся через прокси (внутри login() будет очистка localStorage после загрузки страницы)
      logger.info('StarlineScraperService: 🔐 Logging in via proxy...');
      await this.login();
      
      // После успешного логина получаем cookies из контекста с прокси
      logger.info('StarlineScraperService: 📋 Copying cookies from proxy context...');
      const cookies = await this.contextWithProxy!.cookies();
      logger.info(`StarlineScraperService: ✅ Got ${cookies.length} cookies from proxy context`);
      
      // Создаем НОВЫЙ контекст БЕЗ прокси для быстрой работы
      logger.info('StarlineScraperService: 🚀 Creating fast context WITHOUT proxy...');
      this.context = await this.browser.newContext({
        // БЕЗ прокси - для скорости!
        userAgent: realUserAgent,
        viewport: viewport,
        locale: 'ru-RU',
        timezoneId: 'Asia/Tbilisi',
        extraHTTPHeaders: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
        },
        permissions: ['geolocation'],
        storageState: undefined,
      });
      
      // Переопределяем navigator свойства в новом контексте без прокси
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        (window as any).chrome = { runtime: {} };
      });
      
      // Добавляем cookies в новый контекст без прокси
      await this.context.addCookies(cookies);
      logger.info('StarlineScraperService: ✅ Cookies copied to fast context');
      
      // Закрываем старый контекст с прокси и страницу
      if (this.page) {
        await this.page.close();
      }
      if (this.contextWithProxy) {
        await this.contextWithProxy.close();
        this.contextWithProxy = null;
      }
      
      // Создаем новую страницу в контексте без прокси
      this.page = await this.context.newPage();
      logger.info('StarlineScraperService: ✅ New page created in fast context (no proxy)');
      
      // Переходим на страницу map чтобы убедиться что сессия работает без прокси
      logger.info('StarlineScraperService: 🔄 Navigating to map page without proxy to verify session...');
      await this.page.goto(`${this.BASE_URL}/site/map`, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Проверяем что мы залогинены (без прокси)
      const isLoggedInCheck = await this.page.evaluate(() => {
        return !document.querySelector('a[href="#login"]') && window.location.pathname.includes('/site/map');
      });
      
      if (!isLoggedInCheck) {
        throw new Error('Session verification failed: not logged in after switching to no-proxy context');
      }
      
      logger.info('StarlineScraperService: ✅ Session verified - logged in without proxy');
      
      this.isLoggedIn = true;
      this.isInitializing = false;

      logger.info('StarlineScraperService: ✅ Persistent browser session initialized (proxy → no proxy for speed)');
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

    // Переходим на страницу логина (увеличенный таймаут для прокси - 60 секунд)
    logger.info(`StarlineScraperService: Navigating to ${this.LOGIN_URL} via proxy...`);
    await this.page.goto(this.LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
    logger.info('StarlineScraperService: ✅ Page loaded');

    // Очищаем localStorage и sessionStorage после загрузки страницы
    try {
      await this.page.evaluate(() => {
        // Очищаем localStorage
        localStorage.clear();
        // Очищаем sessionStorage
        sessionStorage.clear();
      });
      logger.info('StarlineScraperService: ✅ localStorage and sessionStorage cleared');
    } catch (error) {
      // Игнорируем ошибки очистки (может быть заблокировано политикой безопасности)
      logger.warn('StarlineScraperService: Could not clear localStorage/sessionStorage (may be blocked by security policy)');
    }

    // Кликаем на кнопку "Вход"
    await this.page.click('a[href="#login"]');
    await this.page.waitForSelector('input[type="text"]', { timeout: 30000 });

    // Вводим логин и пароль
    await this.page.fill('input[type="text"]', this.username);
    await this.page.fill('input[type="password"]', this.password);

    // Кликаем "Войти" и ждем навигации (увеличенный таймаут для прокси - 60 секунд)
    logger.info('StarlineScraperService: Clicking submit button and waiting for navigation...');
    await Promise.all([
      this.page.click('button[type="submit"]'),
      this.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
    ]);
    logger.info('StarlineScraperService: ✅ Navigation completed');

    // Дополнительно ждем пару секунд чтобы страница стабилизировалась
    await this.page.waitForTimeout(2000);

    // Проверяем что залогинились
    const currentUrl = this.page.url();
    if (currentUrl.includes('/site/map')) {
      logger.info('StarlineScraperService: ✅ Login successful');
    } else {
      throw new Error('Login failed: not redirected to map page');
    }
  }

  /**
   * Установка куки из реального браузера (MCP Chrome) для обхода защиты от DDoS
   * Эти куки помогают имитировать реальный браузер
   */
  private async setCookiesFromRealBrowser(): Promise<void> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }

    logger.info('StarlineScraperService: Setting cookies from real browser (MCP Chrome)...');

    // Куки из реального браузера (MCP Chrome)
    // Эти куки помогают обойти защиту от DDoS
    const realBrowserCookies = [
      {
        name: 'map',
        value: 'yandex%23map',
        domain: '.starline-online.ru',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
      {
        name: '_ym_uid',
        value: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        domain: '.starline-online.ru',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
      {
        name: '_ym_d',
        value: String(Math.floor(Date.now() / 1000)),
        domain: '.starline-online.ru',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
      {
        name: '_ym_isad',
        value: '1',
        domain: '.starline-online.ru',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
      {
        name: 'userAgentId',
        value: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        domain: '.starline-online.ru',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
      {
        name: 'lang',
        value: 'ru',
        domain: '.starline-online.ru',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
    ];

    // Устанавливаем куки через Playwright API
    await this.context.addCookies(realBrowserCookies);
    
    logger.info(`StarlineScraperService: ✅ Set ${realBrowserCookies.length} cookies from real browser`);
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
   * Детальная диагностика состояния браузера и страницы
   */
  async diagnose(): Promise<{
    browserConnected: boolean;
    pageExists: boolean;
    isLoggedIn: boolean;
    currentUrl: string | null;
    pageTitle: string | null;
    isOnStarlineDomain: boolean;
    canExecuteJS: boolean;
    fetchTest: { success: boolean; error?: string; responseTime?: number };
    loginStatus: 'logged_in' | 'logged_out' | 'unknown' | 'error';
  }> {
    const result = {
      browserConnected: false,
      pageExists: false,
      isLoggedIn: this.isLoggedIn,
      currentUrl: null as string | null,
      pageTitle: null as string | null,
      isOnStarlineDomain: false,
      canExecuteJS: false,
      fetchTest: { success: false } as { success: boolean; error?: string; responseTime?: number },
      loginStatus: 'unknown' as 'logged_in' | 'logged_out' | 'unknown' | 'error',
    };

    try {
      // Проверка браузера
      result.browserConnected = this.browser?.isConnected() ?? false;
      
      if (!this.page) {
        return { ...result, loginStatus: 'error' };
      }
      
      result.pageExists = true;

      // Проверка URL и заголовка
      try {
        result.currentUrl = this.page.url();
        result.isOnStarlineDomain = result.currentUrl.includes('starline-online.ru');
        
        result.pageTitle = await this.page.title().catch(() => null);
      } catch (error) {
        logger.warn('StarlineScraperService: Cannot get page URL/title:', error);
      }

      // Проверка выполнения JavaScript
      try {
        const testResult = await Promise.race([
          this.page.evaluate(() => {
            // @ts-ignore - код выполняется в браузере
            // @ts-ignore
            return {
              canExecute: true,
              // @ts-ignore
              userAgent: navigator.userAgent,
              // @ts-ignore
              location: window.location.href,
            };
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('JS timeout')), 3000))
        ]);
        result.canExecuteJS = true;
      } catch (error) {
        logger.warn('StarlineScraperService: Cannot execute JS:', error);
        result.canExecuteJS = false;
      }

      // Тест fetch запроса
      try {
        const startTime = Date.now();
        const fetchResult = await Promise.race([
          this.page.evaluate(async () => {
            try {
              const res = await fetch('/api/devices?limit=1', {
                headers: {
                  'Accept': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                },
              });
              return {
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
              };
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 5000))
        ]);
        const responseTime = Date.now() - startTime;
        
        if (typeof fetchResult === 'object' && fetchResult !== null) {
          const fetchData = fetchResult as any;
          result.fetchTest = {
            success: fetchData.ok === true,
            responseTime,
            error: fetchData.error as string | undefined,
          };
        }
      } catch (error) {
        result.fetchTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      // Проверка статуса логина (по наличию элементов или cookies)
      try {
        const loginCheck = await Promise.race([
          this.page.evaluate(() => {
            // @ts-ignore - код выполняется в браузере, где есть document и window
            // Проверяем наличие элементов, которые видны только после логина
            // @ts-ignore
            const hasLoginButton = !!document.querySelector('a[href="#login"]');
            // @ts-ignore
            const hasDevicesList = !!document.querySelector('[data-device-id]') || 
                                  // @ts-ignore
                                  !!document.querySelector('.device-item') ||
                                  // @ts-ignore
                                  window.location.pathname.includes('/site/map');
            
            // Проверяем cookies
            // @ts-ignore
            const cookies = document.cookie;
            const hasSessionCookie = cookies.includes('PHPSESSID') || cookies.includes('session');
            
            return {
              hasLoginButton,
              hasDevicesList,
              hasSessionCookie,
              // @ts-ignore
              path: window.location.pathname,
            };
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Login check timeout')), 3000))
        ]);

        if (typeof loginCheck === 'object' && loginCheck !== null) {
          const check = loginCheck as any;
          if (check.hasDevicesList || check.hasSessionCookie) {
            result.loginStatus = 'logged_in';
          } else if (check.hasLoginButton && !check.hasDevicesList) {
            result.loginStatus = 'logged_out';
          } else {
            result.loginStatus = 'unknown';
          }
        }
      } catch (error) {
        logger.warn('StarlineScraperService: Cannot check login status:', error);
        result.loginStatus = 'error';
      }

    } catch (error) {
      logger.error('StarlineScraperService: Diagnose error:', error);
    }

    return result;
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = String(error);
      const fullErrorText = errorMessage + ' ' + errorString;
      
      // Проверяем на истечение сессии (такая же логика как в getDeviceDetails)
      const hasPageEvaluate = fullErrorText.includes('page.evaluate');
      const hasUnexpectedToken = fullErrorText.includes('Unexpected token');
      const hasCyrillic = /[А-Яа-яЁё]/.test(fullErrorText) || /\\u04[0-9a-fA-F]{2}/.test(fullErrorText);
      
      if (hasPageEvaluate && (hasUnexpectedToken || hasCyrillic)) {
        logger.warn('StarlineScraperService: Session expired in getDevices, restarting browser...');
        
        try {
          await this.restartBrowser();
          logger.info('StarlineScraperService: Retrying getDevices after browser restart...');
          
          // Повторяем запрос после перезапуска
          const response = await this.page!.evaluate(async () => {
            const res = await fetch('/device?tz=240&_=' + Date.now(), {
              headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
              },
            });
            return res.json();
          }) as StarlineAPIResponse<{ devices: StarlineDeviceOverview[] }>;
          
          if (response.result === 1 && response.answer && response.answer.devices) {
            logger.info(`StarlineScraperService: ✅ Fetched ${response.answer.devices.length} devices after restart`);
            return response.answer.devices;
          }
          
          throw new Error('Failed to get Starline devices after restart');
        } catch (restartError) {
          logger.error('StarlineScraperService: Failed to restart browser in getDevices:', restartError);
          throw new Error(`Session expired and browser restart failed: ${errorMessage.substring(0, 200)}`);
        }
      }
      
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
    
    // Обертка для перехвата всех ошибок, включая ошибки из page.evaluate()
    try {
      return await this._getDeviceDetailsInternal(deviceId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = String(error);
      const errorStack = error instanceof Error ? (error.stack || '') : '';
      const fullErrorText = errorMessage + ' ' + errorString + ' ' + errorStack;
      
      // Логируем ВСЕ ошибки для диагностики
      logger.warn(`StarlineScraperService: Error caught in getDeviceDetails for device ${deviceId}`);
      logger.warn(`StarlineScraperService: Error message: ${errorMessage.substring(0, 200)}`);
      logger.warn(`StarlineScraperService: Error string: ${errorString.substring(0, 300)}`);
      logger.warn(`StarlineScraperService: Full error text: ${fullErrorText.substring(0, 500)}`);
      
      // Проверяем на наличие "page.evaluate" и "Unexpected token" в любом виде
      const hasPageEvaluate = fullErrorText.includes('page.evaluate') ||
                             errorMessage.includes('page.evaluate');
      const hasUnexpectedToken = fullErrorText.includes('Unexpected token') ||
                                 errorMessage.includes('Unexpected token');
      const hasCyrillic = /[А-Яа-яЁё]/.test(fullErrorText) || 
                         /\\u04[0-9a-fA-F]{2}/.test(fullErrorText);
      
      logger.warn(`StarlineScraperService: hasPageEvaluate=${hasPageEvaluate}, hasUnexpectedToken=${hasUnexpectedToken}, hasCyrillic=${hasCyrillic}`);
      
      // Если ошибка содержит "page.evaluate" и "Unexpected token" - это истекшая сессия
      if (hasPageEvaluate && (hasUnexpectedToken || hasCyrillic)) {
        logger.warn(`StarlineScraperService: Session expired detected, restarting browser...`);
        
        try {
          await this.restartBrowser();
          // Повторяем запрос после перезапуска
          logger.info(`StarlineScraperService: Retrying fetch for device ${deviceId} after browser restart...`);
          return await this._getDeviceDetailsInternal(deviceId);
        } catch (restartError) {
          logger.error(`StarlineScraperService: Failed to restart browser:`, restartError);
          throw new Error(`Session expired and browser restart failed: ${errorMessage.substring(0, 200)}`);
        }
      }
      
      // Все остальные ошибки пробрасываем дальше
      throw error;
    }
  }

  private async _getDeviceDetailsInternal(deviceId: number): Promise<StarlineDeviceDetails> {
    await this.ensureHealthy();

    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Проверяем, что страница загружена и доступна
      const currentUrl = this.page.url();
      if (!currentUrl.includes('starline-online.ru')) {
        logger.warn(`StarlineScraperService: Page is not on Starline domain (${currentUrl}), navigating...`);
        await this.page.goto(`${this.BASE_URL}/site/map`, { waitUntil: 'networkidle', timeout: 15000 });
      }

      // Убеждаемся, что мы на странице карты (если нет - переходим)
      if (!currentUrl.includes('/site/map')) {
        logger.info('StarlineScraperService: Navigating to /site/map...');
        await this.page.goto(`${this.BASE_URL}/site/map`, { waitUntil: 'networkidle', timeout: 15000 });
        await this.page.waitForTimeout(1000); // Даем время странице стабилизироваться
      }

      // Проверяем авторизацию: если сессия истекла, перелогиниваемся
      const isLoggedIn = await this.page.evaluate(() => {
        // Проверяем наличие элементов, которые видны только после логина
        // @ts-ignore
        const hasLoginButton = !!document.querySelector('a[href="#login"]');
        // @ts-ignore
        const hasDevicesList = !!document.querySelector('[data-device-id]') || 
                              // @ts-ignore
                              !!document.querySelector('.device-item');
        // @ts-ignore
        const currentPath = window.location.pathname;
        
        return {
          hasLoginButton,
          hasDevicesList,
          isOnMapPage: currentPath.includes('/site/map'),
          // @ts-ignore
          cookies: document.cookie
        };
      });

      // Если видим кнопку логина и нет списка устройств - сессия истекла
      if (isLoggedIn.hasLoginButton && !isLoggedIn.hasDevicesList && !isLoggedIn.isOnMapPage) {
        logger.warn('StarlineScraperService: Session expired, re-logging in...');
        this.isLoggedIn = false;
        await this.login();
        // Переходим на страницу карты после логина
        await this.page.goto(`${this.BASE_URL}/site/map`, { waitUntil: 'networkidle', timeout: 15000 });
        await this.page.waitForTimeout(1000);
      }

      // Выполняем fetch с таймаутом через Promise.race
      const response = await Promise.race([
        this.page.evaluate(async (id) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут для fetch
          
          try {
            const res = await fetch(`/device/${id}?tz=240&_=` + Date.now(), {
              headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) {
              // Пытаемся получить текст ошибки
              const errorText = await res.text().catch(() => res.statusText);
              throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 200)}`);
            }
            
            // Получаем текст ответа для проверки
            const responseText = await res.text();
            
            // Проверяем, не является ли это HTML страницей авторизации (проверяем ДО парсинга JSON)
            const lowerText = responseText.toLowerCase();
            if (responseText.includes('Необходима') || 
                responseText.includes('необходима') ||
                responseText.includes('authorization') ||
                responseText.includes('login') ||
                responseText.includes('<!DOCTYPE') ||
                responseText.includes('<html') ||
                lowerText.includes('авторизация') ||
                lowerText.includes('войти')) {
              throw new Error('SESSION_EXPIRED: HTML authorization page received. Text: ' + responseText.substring(0, 200));
            }
            
            // Проверяем Content-Type перед парсингом JSON
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json') && !contentType.includes('text/javascript')) {
              throw new Error(`Expected JSON but got ${contentType}. Response: ${responseText.substring(0, 200)}`);
            }
            
            // Пытаемся распарсить JSON
            try {
              return JSON.parse(responseText);
            } catch (jsonError) {
              // Если не JSON, проверяем на наличие кириллицы (признак HTML страницы)
              const hasCyrillic = /[А-Яа-яЁё]/.test(responseText);
              if (hasCyrillic && (responseText.length > 100 || responseText.includes('<'))) {
                throw new Error('SESSION_EXPIRED: Cyrillic text in response (likely HTML page). Text: ' + responseText.substring(0, 200));
              }
              throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
            }
          } catch (error) {
            clearTimeout(timeoutId);
            // Убеждаемся, что ошибка - это строка или Error объект
            if (error instanceof Error) {
              throw error;
            } else if (typeof error === 'string') {
              throw new Error(error);
            } else {
              throw new Error(`Unknown error: ${JSON.stringify(error)}`);
            }
          }
        }, deviceId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout: page.evaluate() не ответил за 10 секунд для device ${deviceId}`)), 10000)
        )
      ]) as any;

      // Проверяем формат ответа: может быть {result: 1, answer: {...}} или напрямую {...}
      const typedResponse = response as any;
      if (typedResponse.result === 1 && typedResponse.answer) {
        return typedResponse.answer as StarlineDeviceDetails;
      } else if (typedResponse.device_id && typedResponse.alias) {
        // Ответ напрямую без обертки
        return typedResponse as StarlineDeviceDetails;
      }

      logger.error(`StarlineScraperService: Failed to get details for device ${deviceId}. Response:`, response);
      throw new Error(`Failed to get Starline device details for ${deviceId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = String(error);
      
      // Проверяем на наличие признаков истечения сессии
      // Ошибка может содержать кириллицу в экранированном виде (\u041d = 'Н')
      // Проверяем в полном тексте ошибки (message + string + stack)
      const errorStack = error instanceof Error ? (error.stack || '') : '';
      const fullErrorText = errorMessage + ' ' + errorString + ' ' + errorStack;
      
      // Проверяем на наличие unicode символов кириллицы в экранированном виде
      // Паттерн для кириллицы в unicode: \u04xx (где xx - hex код символа)
      const hasCyrillicUnicode = /\\u04[0-9a-fA-F]{2}/.test(fullErrorText);
      
      // Если есть "Unexpected token" - это почти всегда признак HTML страницы вместо JSON
      // Особенно если есть unicode символы (кириллица в экранированном виде)
      const hasUnexpectedToken = errorMessage.includes('Unexpected token') || fullErrorText.includes('Unexpected token');
      const hasUnexpectedTokenWithUnicode = hasUnexpectedToken && hasCyrillicUnicode;
      
      // УПРОЩЕННАЯ ПРОВЕРКА: если есть "Unexpected token" - считаем сессию истекшей
      // Это безопасно, т.к. валидный JSON никогда не вызовет "Unexpected token"
      const isSessionExpired = 
        errorMessage.includes('SESSION_EXPIRED') ||
        errorMessage.includes('Expected JSON but got') || 
        errorMessage.includes('Invalid JSON response') ||
        errorMessage.includes('Необходима') ||
        errorMessage.includes('необходима') ||
        errorMessage.includes('authorization') ||
        hasUnexpectedToken || // УПРОЩЕНО: любая ошибка "Unexpected token" = истекшая сессия
        hasUnexpectedTokenWithUnicode ||
        // Проверяем на наличие кириллицы в сообщении об ошибке (признак HTML страницы)
        /[А-Яа-яЁё]/.test(errorMessage) ||
        /[А-Яа-яЁё]/.test(fullErrorText);
      
      // Логируем для отладки (ВСЕГДА, не только для Unexpected token)
      logger.warn(`StarlineScraperService: Error caught for device ${deviceId}. Error message: ${errorMessage.substring(0, 200)}`);
      logger.warn(`StarlineScraperService: hasCyrillicUnicode=${hasCyrillicUnicode}, hasUnexpectedTokenWithUnicode=${hasUnexpectedTokenWithUnicode}, isSessionExpired=${isSessionExpired}`);
      if (errorMessage.includes('Unexpected token')) {
        logger.warn(`StarlineScraperService: Unexpected token error detected. Full error: ${fullErrorText.substring(0, 500)}`);
      }
      
      if (isSessionExpired) {
        logger.warn(`StarlineScraperService: Session expired detected (error: ${errorMessage.substring(0, 100)}), restarting browser for device ${deviceId}...`);
        try {
          // Просто перезапускаем браузер - это создаст новую сессию
          await this.restartBrowser();
          
          // Повторяем запрос после перезапуска
          logger.info(`StarlineScraperService: Retrying fetch for device ${deviceId} after browser restart...`);
          return await this._getDeviceDetailsInternal(deviceId);
        } catch (restartError) {
          logger.error(`StarlineScraperService: Failed to restart browser:`, restartError);
          throw new Error(`Session expired and browser restart failed: ${errorMessage.substring(0, 200)}`);
        }
      }
      
      logger.error(`StarlineScraperService: Error fetching device details for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Получение HTML страницы с маршрутами за указанный период
   * @param deviceId ID устройства Starline
   * @param dateFrom Дата начала периода (YYYY-MM-DD)
   * @param dateTo Дата конца периода (YYYY-MM-DD)
   * @returns HTML содержимое страницы с маршрутами
   */
  async getRoutesHTML(deviceId: number, dateFrom: string, dateTo: string): Promise<string> {
    await this.ensureHealthy();

    if (!this.page) {
      throw new Error('Page not initialized');
    }

    logger.info(`StarlineScraperService: Getting routes HTML for device ${deviceId} from ${dateFrom} to ${dateTo}...`);

    try {
      // Переходим на страницу карты
      const currentUrl = this.page.url();
      if (!currentUrl.includes('/site/map')) {
        logger.info('StarlineScraperService: Navigating to map page...');
        await this.page.goto(`${this.BASE_URL}/site/map`, { waitUntil: 'networkidle', timeout: 15000 });
        await this.page.waitForTimeout(2000); // Ждем загрузки интерфейса
      }

      // Выбираем устройство через JavaScript (клик по радио-кнопке устройства)
      await this.page.evaluate(async (id) => {
        // @ts-ignore - код выполняется в браузере
        // Пробуем разные селекторы для поиска устройства
        let deviceRadio = document.querySelector(`input[type="radio"][data-device-id="${id}"]`) as HTMLInputElement;
        
        if (!deviceRadio) {
        // Пробуем найти по value
        // @ts-ignore - код выполняется в браузере, где есть document и HTMLInputElement
        deviceRadio = document.querySelector(`input[type="radio"][value="${id}"]`) as any;
        }
        
        if (!deviceRadio) {
          // Пробуем найти все радио-кнопки и выбрать нужную
          // @ts-ignore - код выполняется в браузере, где есть document и HTMLInputElement
          const allRadios = Array.from(document.querySelectorAll('input[type="radio"]')) as any[];
          deviceRadio = allRadios.find(radio => {
            const parent = radio.closest('label, div, li');
            return parent && parent.textContent?.includes(id.toString());
          }) || null;
        }
        
        if (deviceRadio) {
          deviceRadio.click();
          // Ждем немного для обновления интерфейса
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(`Device ${id} not found in device list`);
        }
      }, deviceId);

      // Устанавливаем период через JavaScript
      await this.page.evaluate(async (from: string, to: string) => {
        // @ts-ignore - код выполняется в браузере
        // Ищем кнопку "Период" и кликаем
        // @ts-ignore - код выполняется в браузере
        const periodButton = Array.from(document.querySelectorAll('button')).find(
          // @ts-ignore
          (btn: any) => btn.textContent?.trim().includes('Период') || btn.textContent?.trim() === 'Период'
        ) as HTMLButtonElement;
        
        if (periodButton) {
          periodButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Устанавливаем даты в календаре
        // @ts-ignore
        const dateInputs = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
        if (dateInputs.length >= 2) {
          // @ts-ignore
          dateInputs[0].value = from; // Дата начала
          // @ts-ignore
          dateInputs[1].value = to; // Дата конца
          
          // Триггерим события для обновления UI
          // @ts-ignore
          dateInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
          // @ts-ignore
          dateInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          // @ts-ignore
          dateInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
          // @ts-ignore
          dateInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Ищем и кликаем кнопку "Показать отчет за период" или "Показать отчет"
        // @ts-ignore
        // @ts-ignore - код выполняется в браузере
        const showButton = Array.from(document.querySelectorAll('button')).find(
          // @ts-ignore
          (btn: any) => btn.textContent?.includes('Показать отчет') ||
                 btn.textContent?.includes('Показать') ||
                 btn.getAttribute('class')?.includes('show') ||
                 btn.getAttribute('id')?.includes('show')
        ) as HTMLButtonElement;
        
        if (showButton) {
          showButton.click();
          // Ждем загрузки маршрутов (увеличено время ожидания)
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.warn('Кнопка "Показать отчет" не найдена');
        }
      }, dateFrom as string, dateTo as string);

      // Ждем загрузки маршрутов на странице (увеличено время)
      await this.page.waitForTimeout(5000);
      
      // Дополнительно ждем появления элементов маршрута на карте или в списке
      try {
        await this.page.waitForSelector('.route, .trip, [class*="route"], [class*="trip"], .map, canvas', { 
          timeout: 10000 
        });
      } catch (e) {
        logger.warn('StarlineScraperService: Элементы маршрута не найдены, продолжаем...');
      }

      // Получаем HTML содержимое страницы
      const html = await this.page.content();

      logger.info(`StarlineScraperService: ✅ Routes HTML retrieved (${html.length} bytes)`);
      return html;
    } catch (error) {
      logger.error(`StarlineScraperService: Error getting routes HTML:`, error);
      throw error;
    }
  }

  /**
   * Перезапуск браузера (закрыть и открыть заново)
   * Используется при истечении сессии
   * 
   * Это проще и надежнее, чем попытки перелогина - новая сессия гарантированно работает
   */
  private async restartBrowser(): Promise<void> {
    logger.info('StarlineScraperService: 🔄 Restarting browser with NEW fingerprint (session expired)...');
    
    // Сбрасываем флаг инициализации, чтобы разрешить повторную инициализацию
    this.isInitializing = false;
    
    // Закрываем текущий контекст и страницу
    if (this.page) {
      try {
        await this.page.close().catch(() => {});
      } catch (error) {
        logger.warn('StarlineScraperService: Error closing page during restart:', error);
      }
      this.page = null;
    }
    
    if (this.context) {
      try {
        await this.context.close().catch(() => {});
      } catch (error) {
        logger.warn('StarlineScraperService: Error closing context during restart:', error);
      }
      this.context = null;
    }
    
    // Закрываем браузер полностью для создания нового профиля
    if (this.browser) {
      try {
        await this.browser.close().catch(() => {});
      } catch (error) {
        logger.warn('StarlineScraperService: Error closing browser during restart:', error);
      }
      this.browser = null;
    }
    
    // Сбрасываем состояние
    this.isLoggedIn = false;
    
    // Инициализируем заново с НОВЫМ fingerprint (откроет браузер и залогинится)
    await this.initialize();
    
    logger.info('StarlineScraperService: ✅ Browser restarted successfully with new fingerprint');
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

