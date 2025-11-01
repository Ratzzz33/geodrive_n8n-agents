/**
 * Netlify Function для обработки вебхуков RentProg
 * RentProg отправляет JSON на указанный URL
 * Все вебхуки на этот адрес считаются от RentProg (без валидации)
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Типы филиалов
type BranchName = 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center';

/**
 * Вызов оркестратора через HTTP к основному приложению
 * Или напрямую через импорт (если код доступен)
 */
async function routeToOrchestrator(event: any): Promise<void> {
  try {
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || process.env.JARVIS_API_URL;
    
    if (orchestratorUrl) {
      // HTTP вызов к основному приложению
      const axios = (await import('axios')).default;
      await axios.post(`${orchestratorUrl}/webhook/rentprog`, event, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(`[${event.branch}] Event sent to orchestrator via HTTP`);
    } else {
      // Fallback: логируем (в production нужно настроить ORCHESTRATOR_URL)
      console.log(`[${event.branch}] Event logged (ORCHESTRATOR_URL not configured):`, {
        type: event.type,
        branch: event.branch,
        payloadId: event.payload?.id,
      });
    }
  } catch (error) {
    console.error(`[${event.branch}] Error routing to orchestrator:`, error);
    // Не пробрасываем ошибку - вебхук уже ответил 200 OK
  }
}

/**
 * Главный обработчик
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; body: string }> => {
  const startTime = Date.now();
  
  try {
    // Извлечение branch из пути
    const branch = (event.pathParameters?.branch || event.path.split('/').pop()) as BranchName;
    
    if (!['tbilisi', 'batumi', 'kutaisi', 'service-center'].includes(branch)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'Invalid branch' }),
      };
    }
    
    // Парсинг payload (все запросы считаются от RentProg)
    let payload: any;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'Invalid JSON' }),
      };
    }
    
    // Логирование
    const eventType = payload.event || payload.type || payload.name || 'unknown';
    console.log(`[${branch}] Webhook received: ${eventType}`, {
      branch,
      eventType,
      payloadId: payload.id,
    });
    
    // Быстрый ACK (200 OK)
    const syncMs = Date.now() - startTime;
    const response = {
      ok: true,
      queued: true,
      syncMs,
    };
    
    // Асинхронный вызов оркестратора (не блокируем ответ)
    routeToOrchestrator({
      branch,
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    }).catch((error) => {
      console.error(`[${branch}] Error routing event:`, error);
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'Internal server error' }),
    };
  }
};

