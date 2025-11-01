/**
 * Конфигурация приложения
 * Загружает переменные окружения и валидирует их
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  telegramBotToken: z.string().min(1, 'TELEGRAM_BOT_TOKEN обязателен'),
  databaseUrl: z.string().optional(),
  rentprogApiKey: z.string().optional(),
  umnicoApiToken: z.string().optional(),
  umnicoApiUrl: z.string().url().optional(),
  amocrmSubdomain: z.string().optional(),
  amocrmClientId: z.string().optional(),
  amocrmClientSecret: z.string().optional(),
  stripeApiKey: z.string().optional(),
  yougileApiKey: z.string().optional(),
  yandexMetrikaApiKey: z.string().optional(),
  objectStorageType: z.enum(['gcs', 's3']).optional(),
  objectStorageBucket: z.string().optional(),
  playwrightStarlineLogin: z.string().optional(),
  playwrightStarlinePassword: z.string().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // RentProg v1 integration
  rentprogBaseUrl: z.string().url().optional(),
  rentprogBranchKeys: z.string().optional(), // JSON string
  rentprogTimeoutMs: z.coerce.number().optional(),
  rentprogPageLimit: z.coerce.number().optional(),
  rentprogPollSinceDays: z.coerce.number().optional(),
  // Netlify
  netlifySite: z.string().url().optional(),
  netlifyAuthToken: z.string().optional(),
  // Neon API
  neonApiKey: z.string().optional(),
  // n8n интеграция
  n8nBaseWebhookUrl: z.string().url().optional(),
  n8nEventsUrl: z.string().url().optional(),
  n8nAlertsUrl: z.string().url().optional(),
  n8nAlertsTelegramBotToken: z.string().optional(),
  dedupTtlMinutes: z.coerce.number().optional(),
});

type Config = z.infer<typeof configSchema>;

let configInstance: Config | null = null;

/**
 * Получить конфигурацию (синглтон)
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = configSchema.parse({
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      databaseUrl: process.env.DATABASE_URL,
      rentprogApiKey: process.env.RENTPROG_API_KEY,
      umnicoApiToken: process.env.UMNICO_API_TOKEN,
      umnicoApiUrl: process.env.UMNICO_API_URL,
      amocrmSubdomain: process.env.AMOCRM_SUBDOMAIN,
      amocrmClientId: process.env.AMOCRM_CLIENT_ID,
      amocrmClientSecret: process.env.AMOCRM_CLIENT_SECRET,
      stripeApiKey: process.env.STRIPE_API_KEY,
      yougileApiKey: process.env.YOUGILE_API_KEY,
      yandexMetrikaApiKey: process.env.YANDEX_METRIKA_API_KEY,
      objectStorageType: process.env.OBJECT_STORAGE_TYPE,
      objectStorageBucket: process.env.OBJECT_STORAGE_BUCKET,
      playwrightStarlineLogin: process.env.PLAYWRIGHT_STARLINE_LOGIN,
      playwrightStarlinePassword: process.env.PLAYWRIGHT_STARLINE_PASSWORD,
      logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'info',
      // RentProg v1
      rentprogBaseUrl: process.env.RENTPROG_BASE_URL,
      rentprogBranchKeys: process.env.RENTPROG_BRANCH_KEYS,
      rentprogTimeoutMs: process.env.RENTPROG_TIMEOUT_MS,
      rentprogPageLimit: process.env.RENTPROG_PAGE_LIMIT,
      rentprogPollSinceDays: process.env.RENTPROG_POLL_SINCE_DAYS,
      // Netlify
      netlifySite: process.env.NETLIFY_SITE,
      netlifyAuthToken: process.env.NETLIFY_AUTH_TOKEN,
      // Neon API
      neonApiKey: process.env.NEON_API_KEY,
      // n8n
      n8nBaseWebhookUrl: process.env.N8N_BASE_WEBHOOK_URL,
      n8nEventsUrl: process.env.N8N_EVENTS_URL,
      n8nAlertsUrl: process.env.N8N_ALERTS_URL,
      n8nAlertsTelegramBotToken: process.env.N8N_ALERTS_TELEGRAM_BOT_TOKEN,
      dedupTtlMinutes: process.env.DEDUP_TTL_MINUTES,
    });
  }

  return configInstance;
}

export const config = getConfig();

