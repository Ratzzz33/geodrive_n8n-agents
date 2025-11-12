/**
 * Middleware для логирования всех API запросов
 */

import { Request, Response, NextFunction } from 'express';
import { getSqlConnection } from '../../db/index.js';
import { logger } from '../../utils/logger.js';

interface RequestWithLogging extends Request {
  startTime?: number;
  requestBody?: any;
}

/**
 * Middleware для логирования запросов
 */
export async function apiLoggerMiddleware(
  req: RequestWithLogging,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Пропускаем health checks и статические файлы
  if (req.path === '/health' || req.path.startsWith('/conversations')) {
    return next();
  }

  const startTime = Date.now();
  req.startTime = startTime;
  
  // Сохраняем тело запроса для логирования (только для POST/PUT/PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.requestBody = req.body;
  }

  // Перехватываем ответ
  const originalSend = res.send;
  let responseBody: any = null;

  res.send = function (body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  // Логируем после завершения запроса
  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const sql = getSqlConnection();

      // Найти или создать endpoint в метаданных
      let endpointId: string | null = null;
      
      const endpointResult = await sql`
        SELECT id FROM api_endpoints
        WHERE path = ${req.path} AND method = ${req.method}
        LIMIT 1
      `;

      if (endpointResult.length > 0) {
        endpointId = endpointResult[0].id;
      } else {
        // Создать новый endpoint
        const newEndpoint = await sql`
          INSERT INTO api_endpoints (path, method, status, description)
          VALUES (${req.path}, ${req.method}, 'active', 'Auto-discovered')
          ON CONFLICT (path, method) DO UPDATE SET updated_at = now()
          RETURNING id
        `;
        endpointId = newEndpoint[0]?.id || null;
      }

      // Вычислить размеры
      const requestSize = req.requestBody 
        ? JSON.stringify(req.requestBody).length 
        : 0;
      
      const responseSize = responseBody 
        ? (typeof responseBody === 'string' ? responseBody.length : JSON.stringify(responseBody).length)
        : 0;

      // Сохранить лог
      await sql`
        INSERT INTO api_request_logs (
          endpoint_id,
          path,
          method,
          status_code,
          duration_ms,
          ip_address,
          user_agent,
          request_size_bytes,
          response_size_bytes,
          error_message,
          request_body,
          response_body,
          metadata
        )
        VALUES (
          ${endpointId},
          ${req.path},
          ${req.method},
          ${res.statusCode},
          ${duration},
          ${req.ip || null},
          ${req.get('user-agent') || null},
          ${requestSize},
          ${responseSize},
          ${res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null},
          ${req.requestBody ? JSON.stringify(req.requestBody) : null}::jsonb,
          ${res.statusCode >= 400 && responseBody ? (typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)) : null}::jsonb,
          ${JSON.stringify({
            query: req.query,
            params: req.params,
            headers: {
              'content-type': req.get('content-type'),
              'x-request-id': req.get('x-request-id'),
            }
          })}::jsonb
        )
      `;

      // Логируем только ошибки в консоль
      if (res.statusCode >= 400) {
        logger.warn(`[API] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      }
    } catch (error) {
      // Не прерываем выполнение при ошибке логирования
      logger.error('Failed to log API request:', error);
    }
  });

  next();
}

