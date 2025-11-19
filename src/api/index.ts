/**
 * HTTP API для внешних вызовов (health checks, webhooks)
 */

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { healthCheck } from '../integrations/rentprog.js';
import { sendHealthToN8n } from '../integrations/n8n.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { BranchName } from '../integrations/rentprog.js';
import { apiLoggerMiddleware } from './middleware/apiLogger.js';
import apiStatsRouter from './routes/apiStats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Middleware для логирования API запросов (подключаем ПЕРЕД всеми роутерами)
app.use(apiLoggerMiddleware);

// Статическая раздача веб-интерфейса
const webPath = join(__dirname, '../../web');
app.use('/conversations', express.static(webPath));

// Подключаем роутеры
// import carSearchRouter from './car-search'; // Временно закомментировано
import processHistoryRouter from './routes/processHistory.js';
import eventLinksRouter from './routes/eventLinks.js';
import entityTimelineRouter from './routes/entityTimeline.js';
import syncEmployeeCashRouter from './routes/syncEmployeeCash.js';
import syncBookingsRouter from './routes/syncBookings.js';
import umnicoSendRouter from './routes/umnico-send.js';
import umnicoConversationRouter from './routes/umnico-conversation.js';
import { startEventProcessor } from '../services/eventProcessor.js';
import { startHistoryProcessor } from '../services/historyEventProcessor.js';

let server: ReturnType<typeof app.listen> | null = null;

/**
 * Инициализация HTTP сервера
 */
export function initApiServer(port: number = 3000): void {
  if (server) {
    logger.warn('API server already initialized');
    return;
  }

  // Подключаем роутеры
  // app.use('/api/cars', carSearchRouter); // Временно закомментировано
  // app.use('/process-history', processHistoryRouter); // Временно отключено
  // app.use('/event-links', eventLinksRouter); // Временно отключено (проблема с импортом)
  // app.use('/entity-timeline', entityTimelineRouter); // Временно отключено (проблема с импортом)
  app.use('/', syncEmployeeCashRouter); // POST /sync-employee-cash
  app.use('/', syncBookingsRouter); // POST /sync-bookings
  app.use('/api/umnico', umnicoSendRouter); // POST /api/umnico/send
  app.use('/api/umnico/conversations', umnicoConversationRouter); // GET /api/umnico/conversations/:id
  app.use('/api-stats', apiStatsRouter); // GET /api-stats/* - статистика использования endpoints

  // Health check для RentProg
  app.get('/rentprog/health', async (req, res) => {
    try {
      const health = await healthCheck();
      
      // Отправка в n8n
      const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
      for (const branch of branches) {
        await sendHealthToN8n({
          ts: new Date().toISOString(),
          branch,
          ok: health.perBranch[branch].ok,
          reason: health.perBranch[branch].error,
        });
      }
      
      res.json(health);
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({ ok: false, error: 'Health check failed' });
    }
  });

  // Endpoint для получения вебхуков от RentProg (через Nginx)
  app.post('/webhook/rentprog', async (req, res) => {
    try {
      const { normalizeRentProgWebhook } = await import('../integrations/rentprog-webhook-parser');
      const { route } = await import('../orchestrator/index');
      
      const { type, payload, timestamp } = req.body;
      
      // Нормализуем вебхук в событие системы
      const systemEvent = normalizeRentProgWebhook({
        event: type,
        id: payload?.id,
        payload: payload,
      });
      
      if (!systemEvent) {
        res.status(400).json({ ok: false, error: 'Could not normalize webhook' });
        return;
      }
      
      // Роутим в оркестратор
      await route(systemEvent);
      
      res.json({ ok: true, processed: true });
    } catch (error) {
      logger.error('Webhook handler error:', error);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Endpoint для синхронизации цен филиала
  app.get('/sync-prices/:branch', async (req, res) => {
    try {
      const { branch } = req.params;
      
      // Валидация филиала
      const validBranches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
      if (!validBranches.includes(branch as BranchName)) {
        res.status(400).json({ 
          ok: false, 
          error: `Invalid branch. Must be one of: ${validBranches.join(', ')}` 
        });
        return;
      }
      
      logger.info(`[Price Sync] Starting sync for ${branch}...`);
      
      // Динамический импорт модуля синхронизации
      // @ts-expect-error - .mjs module без типов
      const { syncPricesForBranch } = await import('../../setup/sync_prices_module.mjs');
      
      const result = await syncPricesForBranch(branch);
      
      logger.info(`[Price Sync] Completed for ${branch}: +${result.inserted} ~${result.updated} -${result.skipped} !${result.errors}`);
      
      res.json(result);
      
    } catch (error) {
      logger.error(`[Price Sync] Error:`, error);
      res.status(500).json({
        ok: false,
        branch: req.params.branch,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Endpoint для проверки автомобилей без цен на сезоны - все филиалы
  app.get('/check-cars-without-prices', async (req, res) => {
    try {
      logger.info(`[Price Check] Starting check for all branches...`);
      
      // @ts-expect-error - .mjs module без типов
      const { checkAllBranches } = await import('../../setup/check_cars_without_prices.mjs');
      const results = await checkAllBranches();
      
      const totals = results.reduce((acc: { total: number; withoutPrices: number }, r: any) => ({
        total: acc.total + r.total,
        withoutPrices: acc.withoutPrices + r.withoutPrices
      }), { total: 0, withoutPrices: 0 });
      
      logger.info(`[Price Check] Completed for all branches: ${totals.withoutPrices}/${totals.total} без цен`);
      
      res.json({
        ok: true,
        branches: results,
        summary: {
          total: totals.total,
          withoutPrices: totals.withoutPrices,
          withPrices: totals.total - totals.withoutPrices
        }
      });
    } catch (error) {
      logger.error(`[Price Check] Error:`, error);
      res.status(500).json({
        ok: false,
        branch: 'all',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Endpoint для проверки автомобилей без цен на сезоны - конкретный филиал
  app.get('/check-cars-without-prices/:branch', async (req, res) => {
    try {
      const { branch } = req.params;
      
      logger.info(`[Price Check] Starting check for ${branch}...`);
      
      // Валидация филиала
      const validBranches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
      if (!validBranches.includes(branch as BranchName)) {
        res.status(400).json({ 
          ok: false, 
          error: `Invalid branch. Must be one of: ${validBranches.join(', ')}` 
        });
        return;
      }
      
      // @ts-expect-error - .mjs module без типов
      const { checkBranchCarsWithoutPrices } = await import('../../setup/check_cars_without_prices.mjs');
      const result = await checkBranchCarsWithoutPrices(branch);
      
      logger.info(`[Price Check] Completed for ${branch}: ${result.withoutPrices}/${result.total} без цен`);
      res.json(result);
    } catch (error) {
      logger.error(`[Price Check] Error:`, error);
      res.status(500).json({
        ok: false,
        branch: req.params.branch,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Endpoint для обработки известных вебхуков из n8n (быстрая обработка)
  app.post('/process-webhook', async (req, res) => {
    try {
      const { normalizeRentProgWebhook } = await import('../integrations/rentprog-webhook-parser');
      const { handleRentProgEvent } = await import('../orchestrator/rentprog-handler');
      const { quickUpdateEntity } = await import('./quick-update');
      
      const { event, payload, rentprog_id, company_id, entity_type, operation } = req.body;
      
      if (!event || !rentprog_id) {
        res.status(400).json({ ok: false, error: 'Missing required fields: event, rentprog_id' });
        return;
      }
      
      // Парсинг payload если строка
      let parsedPayload = payload;
      if (typeof payload === 'string') {
        try {
          parsedPayload = JSON.parse(payload);
        } catch (e) {
          res.status(400).json({ ok: false, error: 'Invalid payload format' });
          return;
        }
      }
      
      // Нормализация вебхука
      const systemEvent = normalizeRentProgWebhook({
        event: event,
        id: rentprog_id,
        payload: parsedPayload,
      });
      
      if (!systemEvent) {
        res.status(400).json({ ok: false, error: 'Could not normalize webhook' });
        return;
      }
      
      // Проверка существования сущности
      const { resolveByExternalRef } = await import('../db/upsert');
      const existingEntityId = await resolveByExternalRef('rentprog', rentprog_id);
      
      // Обработка в зависимости от операции
      if (operation === 'delete') {
        // DELETE - архивация сущности
        if (existingEntityId) {
          const { archiveEntity } = await import('../db/archive');
          await archiveEntity(entity_type, existingEntityId);
          
          res.json({ 
            ok: true, 
            processed: true,
            archived: true,
            entityId: existingEntityId
          });
        } else {
          // Сущности нет, нечего архивировать
          res.json({ 
            ok: true, 
            processed: true,
            archived: false,
            message: 'Entity not found'
          });
        }
      } else if (operation === 'create') {
        // CREATE - всегда создаем полную запись из payload
        // Отправляем на полный upsert через Upsert Processor
        res.json({ 
          ok: true, 
          processed: false,
          needsUpsert: true,
          rentprog_id: rentprog_id,
          event: event,
          company_id: company_id,
          entity_type: entity_type
        });
      } else if (operation === 'update') {
        // UPDATE - проверяем существование
        if (existingEntityId) {
          // Быстрый update только измененных полей из вебхука
          const updateResult = await quickUpdateEntity(
            entity_type || systemEvent.type.split('.')[0],
            existingEntityId,
            parsedPayload,
            systemEvent.type
          );
          
          res.json({ 
            ok: true, 
            processed: true,
            updated: true,
            entityId: existingEntityId,
            changes: updateResult.changes
          });
        } else {
          // Сущности нет - нужно делать полный upsert через Upsert Processor
          // Возвращаем needsUpsert=true, чтобы workflow запустил Upsert Processor
          res.json({ 
            ok: true, 
            processed: false,
            needsUpsert: true,
            rentprog_id: rentprog_id,
            event: event,
            company_id: company_id,
            entity_type: entity_type
          });
        }
      } else {
        // Неизвестная операция - обрабатываем как update (backward compatibility)
        if (existingEntityId) {
          const updateResult = await quickUpdateEntity(
            entity_type || systemEvent.type.split('.')[0],
            existingEntityId,
            parsedPayload,
            systemEvent.type
          );
          
          res.json({ 
            ok: true, 
            processed: true,
            updated: true,
            entityId: existingEntityId,
            changes: updateResult.changes
          });
        } else {
          res.json({ 
            ok: true, 
            processed: false,
            needsUpsert: true,
            rentprog_id: rentprog_id,
            event: event,
            company_id: company_id,
            entity_type: entity_type
          });
        }
      }
    } catch (error) {
      logger.error('Process webhook error:', error);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Endpoint для обработки событий из n8n (upsert processor)
  app.post('/process-event', async (req, res) => {
    try {
      const { normalizeRentProgWebhook } = await import('../integrations/rentprog-webhook-parser');
      const { handleRentProgEvent } = await import('../orchestrator/rentprog-handler');
      
      const { type, rentprog_id, eventId } = req.body;
      // Поддержка старого формата ext_id для обратной совместимости
      const ext_id = req.body.rentprog_id || req.body.ext_id;
      
      if (!type || !ext_id) {
        res.status(400).json({ ok: false, error: 'Missing required fields: type, rentprog_id' });
        return;
      }
      
      // Создаем событие для обработки
      const systemEvent = normalizeRentProgWebhook({
        event: type,
        id: ext_id,
        payload: { id: ext_id },
      });
      
      if (!systemEvent) {
        res.status(400).json({ ok: false, error: 'Could not normalize event' });
        return;
      }
      
      // Обрабатываем событие (auto-fetch + upsert)
      // Передаем eventId для связи с timeline
      const result = await handleRentProgEvent(systemEvent, eventId);
      
      res.json({ 
        ok: result.ok, 
        processed: result.processed,
        entityIds: result.entityIds,
        error: result.error 
      });
    } catch (error) {
      logger.error('Process event error:', error);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Endpoint для upsert машины (вызывается из n8n workflow)
  app.post('/upsert-car', async (req, res) => {
    try {
      const { dynamicUpsertEntity } = await import('../db/upsert');
      
      // Обработка странной структуры от n8n, где данные могут приходить под пустым ключом
      let rentprog_id = req.body.rentprog_id;
      let data_hex = req.body.data_hex;
      
      // Если данных нет напрямую, проверяем пустой ключ (n8n bodyParameters bug)
      if (!rentprog_id && !data_hex && req.body['']) {
        try {
          const parsed = JSON.parse(req.body['']);
          rentprog_id = parsed.rentprog_id;
          data_hex = parsed.data_hex;
        } catch (e) {
          // Если не удалось распарсить, продолжаем с пустыми значениями
        }
      }

      if (!rentprog_id || !data_hex) {
        res.status(400).json({ ok: false, error: 'Missing required fields: rentprog_id, data_hex' });
        return;
      }

      // Декодируем hex обратно в JSON
      const dataJson = Buffer.from(data_hex, 'hex').toString('utf8');
      const data = JSON.parse(dataJson);

      const result = await dynamicUpsertEntity('cars', rentprog_id, data);

      res.json({
        ok: true,
        entity_id: result.entity_id,
        created: result.created,
        added_columns: result.added_columns
      });
    } catch (error) {
      logger.error('Upsert car error:', error);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Endpoint для upsert клиента (вызывается из n8n workflow)
  app.post('/upsert-client', async (req, res) => {
    try {
      const { dynamicUpsertEntity } = await import('../db/upsert');
      
      // Обработка странной структуры от n8n, где данные могут приходить под пустым ключом
      let rentprog_id = req.body.rentprog_id;
      let data_hex = req.body.data_hex;
      
      // Если данных нет напрямую, проверяем пустой ключ (n8n bodyParameters bug)
      if (!rentprog_id && !data_hex && req.body['']) {
        try {
          const parsed = JSON.parse(req.body['']);
          rentprog_id = parsed.rentprog_id;
          data_hex = parsed.data_hex;
        } catch (e) {
          // Если не удалось распарсить, продолжаем с пустыми значениями
        }
      }

      if (!rentprog_id || !data_hex) {
        res.status(400).json({ ok: false, error: 'Missing required fields: rentprog_id, data_hex' });
        return;
      }

      // Декодируем hex обратно в JSON
      const dataJson = Buffer.from(data_hex, 'hex').toString('utf8');
      const data = JSON.parse(dataJson);

      const result = await dynamicUpsertEntity('clients', rentprog_id, data);

      res.json({
        ok: true,
        entity_id: result.entity_id,
        created: result.created,
        added_columns: result.added_columns
      });
    } catch (error) {
      logger.error('Upsert client error:', error);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Endpoint для получения метрик Starline GPS Monitor
  app.get('/starline/metrics', async (req, res) => {
    try {
      const { getSqlConnection } = await import('../db/index.js');
      const sql = getSqlConnection();
      const { hours = 24 } = req.query;
      const hoursNum = parseInt(hours as string, 10) || 24;
      
      const intervalStr = `${hoursNum} hours`;
      
      const metrics = await sql`
        SELECT * FROM starline_metrics 
        WHERE timestamp > NOW() - ${intervalStr}::INTERVAL
        ORDER BY timestamp DESC
        LIMIT 100
      `;
      
      // Вычисляем средние значения
      const summary = await sql`
        SELECT 
          COUNT(*) as total_runs,
          AVG(total_duration_ms) as avg_duration_ms,
          AVG(success_rate) as avg_success_rate,
          AVG(processed_devices) as avg_processed_devices,
          SUM(failed_devices) as total_failed_devices,
          AVG(batch_size) as avg_batch_size
        FROM starline_metrics
        WHERE timestamp > NOW() - ${intervalStr}::INTERVAL
      `;
      
      res.json({
        ok: true,
        metrics: metrics as any[],
        summary: (summary as any[])[0] || {},
        hours: hoursNum
      });
    } catch (error) {
      logger.error('Starline metrics error:', error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Endpoint для диагностики Starline scraper
  app.get('/starline/diagnose', async (req, res) => {
    try {
      const { getStarlineScraper } = await import('../services/starline-scraper.js');
      const scraper = getStarlineScraper();
      const diagnosis = await scraper.diagnose();
      
      res.json({
        ok: true,
        diagnosis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Starline diagnose error:', error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Endpoint для получения HTML маршрутов Starline
  app.post('/starline/routes-html', async (req, res) => {
    const startTime = Date.now();
    logger.info(`[Routes HTML] Запрос получен: deviceId=${req.body.deviceId}, dateFrom=${req.body.dateFrom}, dateTo=${req.body.dateTo}`);
    
    try {
      const { deviceId, dateFrom, dateTo } = req.body;

      if (!deviceId || !dateFrom || !dateTo) {
        res.status(400).json({ 
          ok: false, 
          error: 'Missing required fields: deviceId, dateFrom, dateTo' 
        });
        return;
      }

      // Валидация формата дат (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
        res.status(400).json({ 
          ok: false, 
          error: 'Invalid date format. Expected YYYY-MM-DD' 
        });
        return;
      }

      logger.info(`[Routes HTML] Инициализация scraper...`);
      const { getStarlineScraper } = await import('../services/starline-scraper.js');
      const scraper = getStarlineScraper();
      
      // Инициализируем scraper если еще не инициализирован
      logger.info(`[Routes HTML] Проверка инициализации scraper...`);
      await scraper.initialize();
      logger.info(`[Routes HTML] Scraper инициализирован, получаю HTML...`);
      
      // Получаем HTML маршрутов с таймаутом
      const htmlPromise = scraper.getRoutesHTML(
        parseInt(deviceId, 10),
        dateFrom,
        dateTo
      );
      
      // Добавляем общий таймаут 2 минуты
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: получение HTML заняло более 2 минут')), 120000)
      );
      
      const html = await Promise.race([htmlPromise, timeoutPromise]) as string;
      
      const duration = Date.now() - startTime;
      logger.info(`[Routes HTML] ✅ HTML получен за ${duration}ms (${html.length} байт)`);

      // Отправляем HTML как текст
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[Routes HTML] ❌ Ошибка за ${duration}ms:`, error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        duration: duration
      });
    }
  });

  // Endpoint для обновления GPS данных из Starline
  app.post('/starline/update-gps', async (req, res) => {
    try {
      const { StarlineMonitorService } = await import('../services/starline-monitor.js');
      
      const service = new StarlineMonitorService();
      const result = await service.updateGPSData();
      
      res.json({
        ok: true,
        updated: result.updated,
        errors: result.errors,
        details: result.details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Starline GPS update error:', error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Endpoint для синхронизации устройств Starline в таблицу starline_devices
  app.post('/starline/sync-devices', async (req, res) => {
    try {
      const { StarlineDevicesSyncService } = await import('../services/starline-devices-sync.js');
      
      const service = new StarlineDevicesSyncService();
      const result = await service.syncDevices();
      
      res.json({
        ok: true,
        total: result.total,
        new: result.new,
        updated: result.updated,
        errors: result.errors,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Starline sync devices error:', error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Endpoint для автоматического сопоставления устройств с cars
  app.post('/starline/match-devices', async (req, res) => {
    try {
      const { StarlineDevicesSyncService } = await import('../services/starline-devices-sync.js');
      
      const service = new StarlineDevicesSyncService();
      const matches = await service.matchDevicesWithCars();
      
      res.json({
        ok: true,
        matches: matches,
        count: matches.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Starline match devices error:', error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Endpoint для получения статуса синхронизации
  app.get('/starline/sync-status', async (req, res) => {
    try {
      const { StarlineDevicesSyncService } = await import('../services/starline-devices-sync.js');
      
      const service = new StarlineDevicesSyncService();
      const status = await service.getSyncStatus();
      
      res.json({
        ok: true,
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Starline sync status error:', error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Endpoint для сопоставления машин Starline с таблицей cars (legacy - для обратной совместимости)
  app.get('/starline/match-cars', async (req, res) => {
    try {
      const { StarlineMonitorService } = await import('../services/starline-monitor.js');
      
      const service = new StarlineMonitorService();
      const matches = await service.matchCars();
      
      res.json({
        ok: true,
        matches: matches,
        count: matches.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Starline match cars error:', error);
      res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Endpoint для парсинга курсов валют из RentProg через Playwright
  app.post('/scrape-exchange-rates', async (req, res) => {
    try {
      const { branch } = req.body;
      
      const validBranches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
      if (!branch || !validBranches.includes(branch)) {
        res.status(400).json({ 
          success: false, 
          error: `Invalid branch. Must be one of: ${validBranches.join(', ')}` 
        });
        return;
      }
      
      logger.info(`[Exchange Rates] Parsing rates for ${branch}...`);
      
      // Импортируем функцию парсинга
      const { scrapeExchangeRatesForBranch } = await import('../services/exchangeRatesService.js');
      
      const rates = await scrapeExchangeRatesForBranch(branch);
      
      if (!rates || Object.keys(rates).length === 0) {
        res.status(500).json({ 
          success: false, 
          error: 'No exchange rates found' 
        });
        return;
      }
      
      logger.info(`[Exchange Rates] Parsed successfully for ${branch}:`, rates);
      
      res.json({
        success: true,
        branch,
        rates,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error(`[Exchange Rates] Error:`, error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Endpoint для запуска скрипта restore_cars_from_rentprog.mjs
  app.post('/restore-cars', async (req, res) => {
    try {
      logger.info('[Restore Cars] Starting restore_cars_from_rentprog.mjs...');
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      // Путь к скрипту
      const scriptPath = path.join(process.cwd(), 'setup', 'restore_cars_from_rentprog.mjs');
      
      // Запускаем скрипт
      const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 600000 // 10 минут
      });
      
      // Парсим вывод для извлечения статистики
      const output = stdout + (stderr || '');
      
      // Извлекаем итоговую статистику из вывода
      const statsMatch = output.match(/Всего обработано машин: (\d+)[\s\S]*?Добавлено новых: (\d+)[\s\S]*?Обновлено существующих: (\d+)[\s\S]*?Пропущено.*?: (\d+)/);
      
      let stats = {
        totalCars: 0,
        inserted: 0,
        updated: 0,
        skipped: 0
      };
      
      if (statsMatch) {
        stats = {
          totalCars: parseInt(statsMatch[1]) || 0,
          inserted: parseInt(statsMatch[2]) || 0,
          updated: parseInt(statsMatch[3]) || 0,
          skipped: parseInt(statsMatch[4]) || 0
        };
      }
      
      // Извлекаем статистику по филиалам
      const branchStats: Array<{ branch: string; total: number; inserted: number; updated: number; skipped: number; error?: string }> = [];
      const branchRegex = /(tbilisi|batumi|kutaisi|service-center):[\s\S]*?Всего машин: (\d+)[\s\S]*?Добавлено: (\d+)[\s\S]*?Обновлено: (\d+)[\s\S]*?Пропущено: (\d+)/g;
      let branchMatch;
      
      while ((branchMatch = branchRegex.exec(output)) !== null) {
        branchStats.push({
          branch: branchMatch[1],
          total: parseInt(branchMatch[2]) || 0,
          inserted: parseInt(branchMatch[3]) || 0,
          updated: parseInt(branchMatch[4]) || 0,
          skipped: parseInt(branchMatch[5]) || 0
        });
      }
      
      // Проверяем наличие ошибок
      const hasErrors = output.includes('❌ Ошибка') || stderr?.length > 0;
      
      logger.info(`[Restore Cars] Completed: ${stats.totalCars} cars, +${stats.inserted} ~${stats.updated} -${stats.skipped}`);
      
      res.json({
        ok: !hasErrors,
        stats,
        branches: branchStats,
        output: output.slice(-5000), // Последние 5000 символов вывода
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('[Restore Cars] Error:', error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // AmoCRM webhook processing endpoint
  app.post('/amocrm/process-webhook', async (req, res) => {
    try {
      const { event_type, entity_type, amocrm_entity_id, payload, details } = req.body;

      // Быстрый ACK
      res.json({ ok: true, received: true });

      if (!event_type || !entity_type || !amocrm_entity_id) {
        logger.warn('[AmoCRM Webhook] Missing required fields:', { event_type, entity_type, amocrm_entity_id });
        return;
      }

      logger.info(`[AmoCRM Webhook] Processing: ${event_type} (${entity_type}) - ID: ${amocrm_entity_id}`);

      // Для сделок (leads) - обрабатываем данные, полученные через AmoCRM API v4
      if (entity_type === 'lead' && (event_type === 'lead.add' || event_type === 'lead.update' || event_type === 'lead.status')) {
        // Детали уже получены в n8n через AmoCRM API v4
        if (details && details._embedded) {
          logger.info(`[AmoCRM Webhook] Deal ${amocrm_entity_id} details received from API, processing...`);
          // TODO: Upsert в БД через существующую логику
          // details содержит полные данные сделки из AmoCRM API v4
        } else {
          logger.warn(`[AmoCRM Webhook] Deal ${amocrm_entity_id} details not provided, skipping processing`);
        }
      }

      // Для контактов - обновляем если нужно
      if (entity_type === 'contact' && (event_type === 'contact.add' || event_type === 'contact.update')) {
        logger.info(`[AmoCRM Webhook] Contact ${amocrm_entity_id} ${event_type}`);
        // TODO: Upsert контакта в БД
      }

    } catch (error) {
      logger.error('[AmoCRM Webhook] Error processing webhook:', error);
      // Не возвращаем ошибку, т.к. уже отправили ACK
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'jarvis-bot' });
  });

  server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🌐 API server listening on port ${port} (0.0.0.0)`);
    
    // Запускаем обработчик событий через триггеры БД (асинхронно)
    startEventProcessor().then(() => {
      logger.info('✅ Event processor started (listening to pg_notify)');
    }).catch((error) => {
      logger.error('❌ Failed to start event processor:', error);
    });
    
    // Запускаем обработчик history через триггеры БД (асинхронно)
    startHistoryProcessor().then(() => {
      logger.info('✅ History processor started (listening to pg_notify)');
    }).catch((error) => {
      logger.error('❌ Failed to start history processor:', error);
    });
  });
}

/**
 * Остановка HTTP сервера
 */
export function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        logger.info('API server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Запуск сервера если файл запущен напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  initApiServer(port);
}

