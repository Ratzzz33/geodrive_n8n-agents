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

// Подробное логирование входящих вебхуков и сервисных запросов
app.use((req, res, next) => {
  const path = req.path;
  const isWebhookRequest =
    path.startsWith('/webhook') ||
    path.startsWith('/process-webhook') ||
    path.startsWith('/process-event');

  if (!isWebhookRequest) {
    next();
    return;
  }

  const start = Date.now();

  const forwardedForHeader = req.headers['x-forwarded-for'];
  let sourceIp: string | undefined;
  if (Array.isArray(forwardedForHeader)) {
    sourceIp = forwardedForHeader[0];
  } else if (typeof forwardedForHeader === 'string') {
    sourceIp = forwardedForHeader.split(',')[0]?.trim();
  } else {
    sourceIp = req.socket.remoteAddress ?? undefined;
  }

  const headerNamesToLog = [
    'x-request-id',
    'x-webhook-id',
    'x-event-id',
    'x-delivery-id',
    'user-agent',
    'content-length',
    'content-type',
    'x-rp-signature',
  ];
  const headersRecord = req.headers as Record<
    string,
    string | string[] | undefined
  >;
  const headerSnapshot: Record<string, string> = {};
  for (const headerName of headerNamesToLog) {
    const rawValue = headersRecord[headerName];
    if (Array.isArray(rawValue) && rawValue.length > 0) {
      headerSnapshot[headerName] = rawValue.join(', ');
    } else if (typeof rawValue === 'string') {
      headerSnapshot[headerName] = rawValue;
    }
  }

  let bodyPreview: string | undefined;
  if (req.body && Object.keys(req.body).length > 0) {
    try {
      const serialized = JSON.stringify(req.body);
      const maxLength = 2000;
      bodyPreview =
        serialized.length > maxLength
          ? `${serialized.slice(0, maxLength)}… (truncated, ${serialized.length} bytes)`
          : serialized;
    } catch (error) {
      bodyPreview = `[unserializable body: ${(error as Error).message || 'unknown error'}]`;
    }
  }

  const requestId =
    headerSnapshot['x-request-id'] ||
    headerSnapshot['x-webhook-id'] ||
    headerSnapshot['x-event-id'] ||
    headerSnapshot['x-delivery-id'] ||
    null;

  const hasQueryParams = req.query && Object.keys(req.query).length > 0;

  logger.info(`[Webhook] ⇢ ${req.method} ${req.originalUrl}`, {
    requestId,
    sourceIp: sourceIp ?? null,
    headers: headerSnapshot,
    query: hasQueryParams ? req.query : undefined,
    bodyPreview,
  });

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const rawContentLength = res.getHeader('content-length');
    const contentLength = Array.isArray(rawContentLength)
      ? rawContentLength.join(', ')
      : (rawContentLength ?? null);

    logger.info(
      `[Webhook] ⇠ ${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs}ms)`,
      {
        requestId,
        contentLength,
      },
    );
  });

  next();
});

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
      const branches: BranchName[] = [
        'tbilisi',
        'batumi',
        'kutaisi',
        'service-center',
      ];
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
      const { normalizeRentProgWebhook } = await import(
        '../integrations/rentprog-webhook-parser'
      );
      const { route } = await import('../orchestrator/index');

      const { type, payload, timestamp } = req.body;

      // Нормализуем вебхук в событие системы
      const systemEvent = normalizeRentProgWebhook({
        event: type,
        id: payload?.id,
        payload: payload,
      });

      if (!systemEvent) {
        res
          .status(400)
          .json({ ok: false, error: 'Could not normalize webhook' });
        return;
      }

      // Роутим в оркестратор
      await route(systemEvent);

      res.json({ ok: true, processed: true });
    } catch (error) {
      const requestIdHeader =
        req.headers['x-request-id'] ||
        req.headers['x-webhook-id'] ||
        req.headers['x-event-id'] ||
        req.headers['x-delivery-id'];
      const requestId = Array.isArray(requestIdHeader)
        ? requestIdHeader[0]
        : (requestIdHeader ?? null);

      const eventType =
        typeof req.body === 'object'
          ? (req.body?.type ?? req.body?.event ?? 'unknown')
          : 'unknown';

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Webhook handler error', {
        requestId,
        eventType,
        errorMessage,
        errorStack,
      });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Endpoint для обработки известных вебхуков из n8n (быстрая обработка)
  app.post('/process-webhook', async (req, res) => {
    try {
      const { normalizeRentProgWebhook } = await import(
        '../integrations/rentprog-webhook-parser'
      );
      const { handleRentProgEvent } = await import(
        '../orchestrator/rentprog-handler'
      );
      const { quickUpdateEntity } = await import('./quick-update');

      const {
        event,
        payload,
        rentprog_id,
        company_id,
        entity_type,
        operation,
      } = req.body;

      if (!event || !rentprog_id) {
        res.status(400).json({
          ok: false,
          error: 'Missing required fields: event, rentprog_id',
        });
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
        res
          .status(400)
          .json({ ok: false, error: 'Could not normalize webhook' });
        return;
      }

      // Проверка существования сущности
      const { resolveByExternalRef } = await import('../db/upsert');
      const existingEntityId = await resolveByExternalRef(
        'rentprog',
        rentprog_id,
      );

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
            entityId: existingEntityId,
          });
        } else {
          // Сущности нет, нечего архивировать
          res.json({
            ok: true,
            processed: true,
            archived: false,
            message: 'Entity not found',
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
          entity_type: entity_type,
        });
      } else if (operation === 'update') {
        // UPDATE - проверяем существование
        if (existingEntityId) {
          // Быстрый update только измененных полей из вебхука
          const updateResult = await quickUpdateEntity(
            entity_type || systemEvent.type.split('.')[0],
            existingEntityId,
            parsedPayload,
            systemEvent.type,
          );

          res.json({
            ok: true,
            processed: true,
            updated: true,
            entityId: existingEntityId,
            changes: updateResult.changes,
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
            entity_type: entity_type,
          });
        }
      } else {
        // Неизвестная операция - обрабатываем как update (backward compatibility)
        if (existingEntityId) {
          const updateResult = await quickUpdateEntity(
            entity_type || systemEvent.type.split('.')[0],
            existingEntityId,
            parsedPayload,
            systemEvent.type,
          );

          res.json({
            ok: true,
            processed: true,
            updated: true,
            entityId: existingEntityId,
            changes: updateResult.changes,
          });
        } else {
          res.json({
            ok: true,
            processed: false,
            needsUpsert: true,
            rentprog_id: rentprog_id,
            event: event,
            company_id: company_id,
            entity_type: entity_type,
          });
        }
      }
    } catch (error) {
      const requestIdHeader =
        req.headers['x-request-id'] ||
        req.headers['x-webhook-id'] ||
        req.headers['x-event-id'] ||
        req.headers['x-delivery-id'];
      const requestId = Array.isArray(requestIdHeader)
        ? requestIdHeader[0]
        : (requestIdHeader ?? null);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Process webhook error', {
        requestId,
        event: req.body?.event ?? req.body?.type ?? 'unknown',
        rentprog_id: req.body?.rentprog_id ?? req.body?.rentprogId ?? null,
        errorMessage,
        errorStack,
      });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Endpoint для обработки событий из n8n (upsert processor)
  app.post('/process-event', async (req, res) => {
    try {
      const { normalizeRentProgWebhook } = await import(
        '../integrations/rentprog-webhook-parser'
      );
      const { handleRentProgEvent } = await import(
        '../orchestrator/rentprog-handler'
      );

      const { type, rentprog_id, eventId } = req.body;
      // Поддержка старого формата ext_id для обратной совместимости
      const ext_id = req.body.rentprog_id || req.body.ext_id;

      if (!type || !ext_id) {
        res.status(400).json({
          ok: false,
          error: 'Missing required fields: type, rentprog_id',
        });
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
        error: result.error,
      });
    } catch (error) {
      const requestIdHeader =
        req.headers['x-request-id'] ||
        req.headers['x-webhook-id'] ||
        req.headers['x-event-id'] ||
        req.headers['x-delivery-id'];
      const requestId = Array.isArray(requestIdHeader)
        ? requestIdHeader[0]
        : (requestIdHeader ?? null);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Process event error', {
        requestId,
        type: req.body?.type ?? 'unknown',
        rentprog_id: req.body?.rentprog_id ?? req.body?.ext_id ?? null,
        errorMessage,
        errorStack,
      });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'jarvis-bot' });
  });

  server = app.listen(port, () => {
    logger.info(`🌐 API server listening on port ${port}`);
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
