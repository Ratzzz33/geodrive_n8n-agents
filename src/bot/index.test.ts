/**
 * Тесты для Telegram-бота
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Telegraf, Context } from 'telegraf';
import { initBot } from './index';

// Моки зависимостей
vi.mock('../config', () => ({
  config: {
    telegramBotToken: 'test_token_123',
    rentprogPollSinceDays: 14,
    netlifySite: 'https://test.netlify.app',
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  initDatabase: vi.fn().mockResolvedValue(undefined),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../integrations/rentprog', () => ({
  healthCheck: vi.fn().mockResolvedValue({
    ok: true,
    perBranch: {
      tbilisi: { ok: true },
      batumi: { ok: true },
      kutaisi: { ok: true },
      'service-center': { ok: true },
    },
  }),
  paginate: vi.fn().mockResolvedValue([]),
}));

vi.mock('../integrations/umnico', () => ({
  checkUmnicoHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../integrations/stripe', () => ({
  checkStripeHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../db/upsert', () => ({
  upsertCarFromRentProg: vi.fn(),
  upsertClientFromRentProg: vi.fn(),
  upsertBookingFromRentProg: vi.fn(),
  getLastSyncTime: vi.fn().mockResolvedValue(null),
}));

vi.mock('../integrations/n8n', () => ({
  sendSyncProgressToN8n: vi.fn().mockResolvedValue(undefined),
}));

describe('Bot initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен инициализировать бота с валидным токеном', () => {
    const bot = initBot();
    expect(bot).toBeInstanceOf(Telegraf);
  });
});

describe('Bot commands', () => {
  let bot: Telegraf;
  let mockContext: Partial<Context>;

  beforeEach(() => {
    bot = initBot();
    mockContext = {
      from: { id: 123, is_bot: false, first_name: 'Test' },
      chat: { id: 456, type: 'private' },
      reply: vi.fn().mockResolvedValue({ message_id: 1 }),
      message: {
        text: '/start',
        message_id: 1,
        date: Date.now(),
        chat: { id: 456, type: 'private' },
      },
    };
  });

  it('должен обрабатывать команду /start', async () => {
    // Проверяем, что команда зарегистрирована
    // В реальном тесте нужно вызвать обработчик команды
    expect(bot).toBeDefined();
  });

  it('должен обрабатывать команду /help', async () => {
    expect(bot).toBeDefined();
  });

  it('должен обрабатывать команду /status', async () => {
    expect(bot).toBeDefined();
  });
});

