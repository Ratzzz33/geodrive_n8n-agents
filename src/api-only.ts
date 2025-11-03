/**
 * Запуск только API сервера (без бота)
 */

import { initDatabase, closeDatabase } from './db';
import { logger } from './utils/logger';
import { initApiServer, stopApiServer } from './api';

/**
 * Главная функция
 */
async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Jarvis API Server (API only mode)...');

    // Инициализация БД
    try {
      await initDatabase();
      logger.info('✅ Database connected');
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

    // Запуск HTTP API сервера
    const port = Number(process.env.API_PORT) || 3000;
    initApiServer(port);

    logger.info(`✅ Jarvis API Server is running on port ${port}`);
    logger.info('📝 Available endpoints:');
    logger.info('   GET  /health');
    logger.info('   GET  /rentprog/health');
    logger.info('   POST /process-webhook');
    logger.info('   POST /update-entity');
    logger.info('   POST /process-event');
  } catch (error) {
    logger.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

// Обработка graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n👋 Shutting down gracefully...');
  try {
    await stopApiServer();
    await closeDatabase();
    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('\n👋 Received SIGTERM, shutting down...');
  try {
    await stopApiServer();
    await closeDatabase();
    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Запуск
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

