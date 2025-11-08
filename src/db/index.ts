/**
 * Подключение к базе данных (PostgreSQL/Neon)
 * Использует Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, lt } from 'drizzle-orm';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import * as schema from './schema.js';

let connection: postgres.Sql | null = null;
export let db: ReturnType<typeof drizzle> | null = null;

/**
 * Инициализация подключения к БД
 */
export async function initDatabase(): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL не установлен в переменных окружения');
  }

  // Маскируем пароль в логах
  const maskedUrl = config.databaseUrl.replace(/:[^:@]+@/, ':***@');
  logger.debug(`Подключаюсь к БД: ${maskedUrl}`);

  try {
    // Для Neon требуется SSL, но параметры SSL могут быть в URL
    // Проверяем, есть ли sslmode в URL
    const urlHasSsl = config.databaseUrl.includes('sslmode=');
    
    const connectionOptions: postgres.Options<{}> = {
      max: 1, // Для MVP достаточно одного соединения
    };
    
    // Если SSL не указан в URL, добавляем явно
    if (!urlHasSsl) {
      connectionOptions.ssl = { rejectUnauthorized: false }; // Для Neon
    }
    
    connection = postgres(config.databaseUrl, connectionOptions);

    db = drizzle(connection, { schema });

    // Простая health-probe
    await connection`SELECT 1`;
    logger.info('✅ DB connected');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('❌ DB connection failed:', {
      message: errorMessage,
      stack: errorStack,
      url: maskedUrl,
    });
    
    // Детальная информация об ошибке
    if (errorMessage.includes('getaddrinfo')) {
      logger.error('Ошибка DNS: не удалось разрешить имя хоста БД');
    } else if (errorMessage.includes('timeout')) {
      logger.error('Таймаут подключения: БД не отвечает');
    } else if (errorMessage.includes('password') || errorMessage.includes('authentication')) {
      logger.error('Ошибка аутентификации: проверьте пароль');
    } else if (errorMessage.includes('SSL')) {
      logger.error('Ошибка SSL: проверьте параметры SSL в URL');
    }
    
    throw error;
  }
}

/**
 * Получить экземпляр БД
 */
export function getDatabase() {
  if (!db) {
    throw new Error('База данных не инициализирована. Вызовите initDatabase() сначала.');
  }
  return db;
}

/**
 * Проверка подключения к БД
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!connection) {
    return false;
  }

  try {
    await connection`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Закрытие подключения к БД
 */
export async function closeDatabase(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
    db = null;
    logger.info('DB connection closed');
  }
}

/**
 * Экспорт схемы для использования в миграциях
 */
export { schema };

/**
 * Экспорт SQL connection для raw запросов
 */
export function getSqlConnection(): postgres.Sql {
  if (!connection) {
    throw new Error('База данных не инициализирована. Вызовите initDatabase() сначала.');
  }
  return connection;
}

/**
 * Функция дедупликации вебхуков
 */
export async function checkWebhookDedup(
  source: string,
  dedupHash: string
): Promise<boolean> {
  if (!db) {
    throw new Error('База данных не инициализирована');
  }

  const existing = await db
    .select()
    .from(schema.webhookDedup)
    .where(eq(schema.webhookDedup.dedup_hash, dedupHash))
    .limit(1);

  return existing.length > 0;
}

/**
 * Сохранить хеш вебхука для дедупликации
 */
export async function saveWebhookDedup(
  source: string,
  dedupHash: string
): Promise<void> {
  if (!db) {
    throw new Error('База данных не инициализирована');
  }

  try {
    await db.insert(schema.webhookDedup).values({
      source,
      dedup_hash: dedupHash,
    });
  } catch (error) {
    // Игнорируем ошибку уникальности (дубликат)
    if (error instanceof Error && !error.message.includes('unique')) {
      throw error;
    }
  }
}

/**
 * Очистка старых записей дедупа (старше TTL)
 */
export async function cleanupWebhookDedup(ttlMinutes: number): Promise<void> {
  if (!db || !connection) {
    return;
  }

  const ttlDate = new Date();
  ttlDate.setMinutes(ttlDate.getMinutes() - ttlMinutes);

  // Используем Drizzle delete вместо raw SQL
  await db
    .delete(schema.webhookDedup)
    .where(lt(schema.webhookDedup.received_at, ttlDate));
}

