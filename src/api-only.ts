/**
 * Запуск только API сервера (без бота)
 */

import { initDatabase, closeDatabase } from './db/index.js';
import { logger } from './utils/logger.js';
import { initApiServer, stopApiServer } from './api/index.js';
import { getStarlineScraper } from './services/starline-scraper.js';

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

    // Инициализация Starline Scraper (persistent browser session)
    logger.info('🌐 Initializing Starline Scraper (persistent Playwright session)...');
    try {
      const scraper = getStarlineScraper();
      await scraper.initialize();
      logger.info('✅ Starline Scraper initialized successfully!');
      logger.info('   Browser: Chromium (headless)');
      logger.info('   Status: Logged in and ready');
      logger.info('   Mode: Persistent session (no re-login needed)');
      
      // Проверяем что scraper работает
      const isHealthy = await scraper.isHealthy();
      if (isHealthy) {
        logger.info('✅ Starline Scraper health check passed');
      } else {
        logger.warn('⚠️  Starline Scraper health check failed, will retry on next request');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Starline Scraper initialization failed');
      logger.error(`   Error: ${errorMessage}`);
      logger.warn('   Starline GPS monitoring will not work until manual restart');
      logger.warn('   To restart: systemctl restart jarvis-api');
      
      // Детальное логирование для диагностики
      if (error instanceof Error && error.stack) {
        logger.debug('Starline initialization error stack:', error.stack);
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
    
    // Закрываем Starline Scraper (браузер)
    const scraper = getStarlineScraper();
    await scraper.shutdown();
    
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
    
    // Закрываем Starline Scraper (браузер)
    const scraper = getStarlineScraper();
    await scraper.shutdown();
    
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

