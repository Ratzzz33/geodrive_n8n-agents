/**
 * HTTP API для внешних вызовов (health checks, webhooks)
 */

import express from 'express';
import { healthCheck } from '../integrations/rentprog.js';
import { sendHealthToN8n } from '../integrations/n8n.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { BranchName } from '../integrations/rentprog.js';

const app = express();
app.use(express.json());

// Подключаем роутеры
// import carSearchRouter from './car-search'; // Временно закомментировано
// import processHistoryRouter from './routes/processHistory.js'; // Временно отключено
import eventLinksRouter from './routes/eventLinks.js';
import entityTimelineRouter from './routes/entityTimeline.js';

let server: ReturnType<typeof app.listen> | null = null;

/**
 * Инициализация HTTP сервера
 */
export function initApiServer(port: number = 3000): void {
  if (server) {
    logger.warn('API server already initialized');
    return;
  }

  // TEST ENDPOINT
  app.post('/test-endpoint', (req, res) => {
    logger.info('TEST ENDPOINT HIT!');
    res.json({ ok: true, message: 'Test endpoint works!' });
  });

  // Подключаем роутеры
  // app.use('/api/cars', carSearchRouter); // Временно закомментировано
  // app.use('/process-history', processHistoryRouter); // Временно отключено
  app.use('/event-links', eventLinksRouter);
  app.use('/entity-timeline', entityTimelineRouter);

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
      logger.debug('upsert-client: Received request', { body: req.body, headers: req.headers });
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

