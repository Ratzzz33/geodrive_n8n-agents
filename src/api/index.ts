/**
 * HTTP API для внешних вызовов (health checks, webhooks)
 */

import express from 'express';
import { healthCheck } from '../integrations/rentprog';
import { sendHealthToN8n } from '../integrations/n8n';
import { logger } from '../utils/logger';
import { config } from '../config';
import type { BranchName } from '../integrations/rentprog';

const app = express();
app.use(express.json());

let server: ReturnType<typeof app.listen> | null = null;

/**
 * Инициализация HTTP сервера
 */
export function initApiServer(port: number = 3000): void {
  if (server) {
    logger.warn('API server already initialized');
    return;
  }

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
      const result = await handleRentProgEvent(systemEvent);
      
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
      const { rentprog_id, data_hex } = req.body;

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
      const { rentprog_id, data_hex } = req.body;

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

