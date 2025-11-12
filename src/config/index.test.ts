/**
 * Тесты для конфигурации
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Мокируем dotenv
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(() => ({ error: null })),
  },
}));

describe('Config validation', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Очищаем process.env перед каждым тестом
    process.env = { ...originalEnv };
    // Устанавливаем обязательное поле
    process.env.TELEGRAM_BOT_TOKEN = 'test_token_123';
    // Очищаем кэш модуля для применения новых env
    await vi.resetModules();
  });

  afterEach(async () => {
    process.env = originalEnv;
    // Очищаем кэш модуля после каждого теста
    await vi.resetModules();
  });

  describe('getConfig', () => {
    it('должен успешно загрузить конфигурацию с минимальными обязательными полями', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token_123';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config = getConfig();
      
      expect(config).toBeDefined();
      expect(config.telegramBotToken).toBe('test_token_123');
    });

    it('должен выбросить ошибку если TELEGRAM_BOT_TOKEN отсутствует', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      await vi.resetModules();
      
      // При импорте модуля создается синглтон, который вызовет getConfig()
      // и выбросит ошибку, поэтому проверяем что импорт выбрасывает ошибку
      await expect(async () => {
        await import('./index');
      }).rejects.toThrow();
    });

    it('должен выбросить ошибку если TELEGRAM_BOT_TOKEN пустой', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '';
      await vi.resetModules();
      
      // При импорте модуля создается синглтон, который вызовет getConfig()
      // и выбросит ошибку, поэтому проверяем что импорт выбрасывает ошибку
      await expect(async () => {
        await import('./index');
      }).rejects.toThrow();
    });

    it('должен загрузить опциональные поля если они установлены', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.DATABASE_URL = 'postgresql://test';
      process.env.RENTPROG_API_KEY = 'test_key';
      process.env.UMNICO_API_TOKEN = 'test_token';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config = getConfig();
      
      expect(config.databaseUrl).toBe('postgresql://test');
      expect(config.rentprogApiKey).toBe('test_key');
      expect(config.umnicoApiToken).toBe('test_token');
    });

    it('должен использовать значения по умолчанию для опциональных полей', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config = getConfig();
      
      expect(config.logLevel).toBe('info');
    });

    it('должен валидировать logLevel enum', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.LOG_LEVEL = 'debug';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config = getConfig();
      
      expect(config.logLevel).toBe('debug');
    });

    it('должен валидировать URL поля', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.UMNICO_API_URL = 'not-a-url';
      await vi.resetModules();
      
      // При импорте модуля создается синглтон, который вызовет getConfig()
      // и выбросит ошибку, поэтому проверяем что импорт выбрасывает ошибку
      await expect(async () => {
        await import('./index');
      }).rejects.toThrow();
    });

    it('должен парсить числовые поля', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.RENTPROG_TIMEOUT_MS = '5000';
      process.env.RENTPROG_PAGE_LIMIT = '20';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config = getConfig();
      
      expect(config.rentprogTimeoutMs).toBe(5000);
      expect(config.rentprogPageLimit).toBe(20);
    });

    it('должен возвращать тот же экземпляр при повторном вызове (singleton)', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2);
    });

    it('должен загрузить RentProg конфигурацию', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.RENTPROG_BASE_URL = 'https://rentprog.net/api/v1/public';
      process.env.RENTPROG_BRANCH_KEYS = '{"tbilisi":"key1","batumi":"key2","kutaisi":"key3","service-center":"key4"}';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config = getConfig();
      
      expect(config.rentprogBaseUrl).toBe('https://rentprog.net/api/v1/public');
      expect(config.rentprogBranchKeys).toBeDefined();
    });

    it('должен загрузить n8n конфигурацию', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.N8N_BASE_WEBHOOK_URL = 'https://webhook.rentflow.rentals';
      process.env.N8N_EVENTS_URL = 'https://webhook.rentflow.rentals/events';
      await vi.resetModules();
      const { getConfig } = await import('./index');
      
      const config = getConfig();
      
      expect(config.n8nBaseWebhookUrl).toBe('https://webhook.rentflow.rentals');
      expect(config.n8nEventsUrl).toBe('https://webhook.rentflow.rentals/events');
    });
  });
});
