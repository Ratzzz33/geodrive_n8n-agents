/**
 * Тесты для Telegram-бота
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Telegraf } from 'telegraf';

// Моки зависимостей (должны быть до любых импортов)
vi.mock('../config', async () => {
  return {
    config: {
      telegramBotToken: 'test_token_123',
      rentprogPollSinceDays: 14,
      netlifySite: 'https://test.netlify.app',
    },
    getConfig: vi.fn(() => ({
      telegramBotToken: 'test_token_123',
      rentprogPollSinceDays: 14,
      netlifySite: 'https://test.netlify.app',
    })),
  };
});

vi.mock('../utils/logger', async () => {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('../db', async () => {
  return {
    checkDatabaseHealth: vi.fn().mockResolvedValue(true),
    initDatabase: vi.fn().mockResolvedValue(undefined),
    closeDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../integrations/rentprog', async () => {
  return {
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
  };
});

vi.mock('../integrations/umnico', async () => {
  return {
    checkUmnicoHealth: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('../integrations/stripe', async () => {
  return {
    checkStripeHealth: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('../db/upsert', async () => {
  return {
    upsertCarFromRentProg: vi.fn(),
    upsertClientFromRentProg: vi.fn(),
    upsertBookingFromRentProg: vi.fn(),
    getLastSyncTime: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('../integrations/n8n', async () => {
  return {
    sendSyncProgressToN8n: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Bot initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен инициализировать бота с валидным токеном', async () => {
    const { initBot } = await import('./index');
    const bot = initBot();
    expect(bot).toBeInstanceOf(Telegraf);
  });
});

describe('Bot commands', () => {
  let bot: Telegraf;

  beforeEach(async () => {
    const { initBot } = await import('./index');
    bot = initBot();
  });

  it('должен быть определен экземпляр бота', () => {
    expect(bot).toBeDefined();
  });

  it('бот должен быть экземпляром Telegraf', () => {
    expect(bot).toBeInstanceOf(Telegraf);
  });
});

