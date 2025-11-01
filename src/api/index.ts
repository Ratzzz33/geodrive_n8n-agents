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

  // Endpoint для получения вебхуков от Netlify Functions
  app.post('/webhook/rentprog', async (req, res) => {
    try {
      const { normalizeRentProgWebhook } = await import('../integrations/rentprog-webhook-parser');
      const { route } = await import('../orchestrator/index');
      
      const { branch, type, payload, timestamp } = req.body;
      
      // Нормализуем вебхук в событие системы
      const systemEvent = normalizeRentProgWebhook(branch, {
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

