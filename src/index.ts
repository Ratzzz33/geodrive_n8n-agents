/**
 * Точка входа приложения
 * Инициализирует все компоненты системы
 */

import { initDatabase, closeDatabase } from './db/index.js';
import { startBot, stopBot } from './bot/index.js';
import { logger } from './utils/logger.js';
import { initApiServer, stopApiServer } from './api/index.js';

/**
 * Главная функция
 */
async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Jarvis Bot...');

    // Инициализация БД
    try {
      await initDatabase();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('⚠️  Database connection failed, continuing without DB');
      logger.warn(`   Error: ${errorMessage}`);
      logger.warn('   Some features may not work');
      
      // Детальное логирование для диагностики
      if (error instanceof Error && error.stack) {
        logger.debug('Database connection error stack:', error.stack);
      }
    }

    // Запуск HTTP API сервера (для health checks)
    initApiServer(Number(process.env.API_PORT) || 3000);

    // Запуск бота
    await startBot();

    logger.info('✅ Jarvis Bot is running');
  } catch (error) {
    logger.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

// Запуск
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await stopBot();
  await stopApiServer();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await stopBot();
  await stopApiServer();
  await closeDatabase();
  process.exit(0);
});

