/**
 * Конфигурация приложения
 * Загружает переменные окружения и валидирует их
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Загружаем .env из корня проекта (cwd - это директория, откуда запущен процесс)
// На сервере процесс запускается из /root/geodrive_n8n-agents, поэтому .env должен быть там
const envPath = join(process.cwd(), '.env');
const dotenvResult = dotenv.config({ path: envPath });

// Если не удалось загрузить из cwd, пробуем текущую директорию
if (dotenvResult.error) {
  dotenv.config(); // Пробуем без указания пути
}

// Логируем результат только если включен debug
if (process.env.DEBUG === 'true' || process.env.LOG_LEVEL === 'debug') {
  console.log(`[DEBUG] CWD: ${process.cwd()}`);
  console.log(`[DEBUG] Пробовал загрузить .env из: ${envPath}`);
  console.log(`[DEBUG] DATABASE_URL установлен: ${!!process.env.DATABASE_URL}`);
  if (process.env.DATABASE_URL) {
    const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@');
    console.log(`[DEBUG] DATABASE_URL: ${masked.substring(0, 50)}...`);
  }
}

const configSchema = z.object({
  // Основной Telegram бот для работы с пользователями (команды, ответы)
  // Бот: @test_geodrive_check_bot (или другой основной бот)
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
  // Neon API
  neonApiKey: z.string().optional(),
  // n8n интеграция
  n8nBaseWebhookUrl: z.string().url().optional(),
  n8nEventsUrl: z.string().url().optional(),
  n8nAlertsUrl: z.string().url().optional(),
  // Бот для алертов через n8n (используется в n8n workflows для отправки уведомлений)
  // Бот: @n8n_alert_geodrive_bot
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

