/**
 * API для просмотра статистики использования endpoints
 */

import { Router, Request, Response } from 'express';
import { getSqlConnection } from '../../db/index.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api-stats/endpoints
 * Список всех endpoints с метаданными
 */
router.get('/endpoints', async (req: Request, res: Response) => {
  try {
    const sql = getSqlConnection();
    const endpoints = await sql`
      SELECT 
        id,
        path,
        method,
        status,
        description,
        category,
        created_at,
        updated_at,
        (
          SELECT COUNT(*) 
          FROM api_request_logs 
          WHERE endpoint_id = api_endpoints.id
        ) as total_requests,
        (
          SELECT COUNT(*) 
          FROM api_request_logs 
          WHERE endpoint_id = api_endpoints.id 
            AND status_code >= 400
        ) as error_count,
        (
          SELECT AVG(duration_ms) 
          FROM api_request_logs 
          WHERE endpoint_id = api_endpoints.id
        ) as avg_duration_ms
      FROM api_endpoints
      ORDER BY path, method
    `;

    res.json({
      ok: true,
      endpoints: endpoints.map((e: any) => ({
        id: e.id,
        path: e.path,
        method: e.method,
        status: e.status,
        description: e.description,
        category: e.category,
        stats: {
          totalRequests: Number(e.total_requests) || 0,
          errorCount: Number(e.error_count) || 0,
          avgDurationMs: e.avg_duration_ms ? Math.round(Number(e.avg_duration_ms)) : null,
        },
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      })),
    });
  } catch (error) {
    logger.error('Error getting endpoints:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api-stats/requests
 * Логи запросов с фильтрацией
 */
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const {
      path,
      method,
      statusCode,
      startDate,
      endDate,
      limit = '100',
      offset = '0',
    } = req.query;

    const sql = getSqlConnection();
    let conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (path) {
      conditions.push(`l.path = $${paramIndex}`);
      params.push(path);
      paramIndex++;
    }
    if (method) {
      conditions.push(`l.method = $${paramIndex}`);
      params.push(method);
      paramIndex++;
    }
    if (statusCode) {
      conditions.push(`l.status_code = $${paramIndex}`);
      params.push(parseInt(statusCode as string));
      paramIndex++;
    }
    if (startDate) {
      conditions.push(`l.request_time >= $${paramIndex}::timestamptz`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`l.request_time <= $${paramIndex}::timestamptz`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const query = `
      SELECT 
        l.id,
        l.path,
        l.method,
        l.status_code,
        l.request_time,
        l.duration_ms,
        l.ip_address,
        l.user_agent,
        l.error_message,
        e.status as endpoint_status,
        e.description as endpoint_description
      FROM api_request_logs l
      LEFT JOIN api_endpoints e ON l.endpoint_id = e.id
      ${whereClause}
      ORDER BY l.request_time DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limitNum, offsetNum);

    const logs = await sql.unsafe(query, params);

    res.json({
      ok: true,
      logs: logs.map((l: any) => ({
        id: l.id,
        path: l.path,
        method: l.method,
        statusCode: l.status_code,
        requestTime: l.request_time,
        durationMs: l.duration_ms,
        ipAddress: l.ip_address,
        userAgent: l.user_agent,
        errorMessage: l.error_message,
        endpointStatus: l.endpoint_status,
        endpointDescription: l.endpoint_description,
      })),
      pagination: {
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (error) {
    logger.error('Error getting request logs:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api-stats/summary
 * Сводная статистика
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const sql = getSqlConnection();

    let dateFilter = '';
    const params: any[] = [];
    if (startDate && endDate) {
      dateFilter = 'WHERE request_time BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = 'WHERE request_time >= $1';
      params.push(startDate);
    } else if (endDate) {
      dateFilter = 'WHERE request_time <= $1';
      params.push(endDate);
    }

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT path) as unique_endpoints,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
        AVG(duration_ms) as avg_duration_ms,
        MAX(duration_ms) as max_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        SUM(request_size_bytes) as total_request_bytes,
        SUM(response_size_bytes) as total_response_bytes
      FROM api_request_logs
      ${dateFilter}
    `;

    const summary = await sql.unsafe(summaryQuery, params);

    const byMethodQuery = `
      SELECT 
        method,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration
      FROM api_request_logs
      ${dateFilter}
      GROUP BY method
      ORDER BY count DESC
    `;

    const byMethod = await sql.unsafe(byMethodQuery, params);

    const byStatusQuery = `
      SELECT 
        status_code,
        COUNT(*) as count
      FROM api_request_logs
      ${dateFilter}
      GROUP BY status_code
      ORDER BY count DESC
    `;

    const byStatus = await sql.unsafe(byStatusQuery, params);

    const topEndpointsQuery = `
      SELECT 
        path,
        method,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM api_request_logs
      ${dateFilter}
      GROUP BY path, method
      ORDER BY count DESC
      LIMIT 10
    `;

    const topEndpoints = await sql.unsafe(topEndpointsQuery, params);

    const summaryData = summary[0] || {};
    const totalRequests = Number(summaryData.total_requests) || 0;
    const errorCount = Number(summaryData.error_count) || 0;

    res.json({
      ok: true,
      summary: {
        totalRequests,
        uniqueEndpoints: Number(summaryData.unique_endpoints) || 0,
        errorCount,
        errorRate: totalRequests > 0 
          ? ((errorCount / totalRequests) * 100).toFixed(2) + '%'
          : '0%',
        avgDurationMs: summaryData.avg_duration_ms ? Math.round(Number(summaryData.avg_duration_ms)) : null,
        maxDurationMs: summaryData.max_duration_ms || null,
        minDurationMs: summaryData.min_duration_ms || null,
        totalRequestBytes: Number(summaryData.total_request_bytes) || 0,
        totalResponseBytes: Number(summaryData.total_response_bytes) || 0,
      },
      byMethod: byMethod.map((m: any) => ({
        method: m.method,
        count: Number(m.count),
        avgDurationMs: m.avg_duration ? Math.round(Number(m.avg_duration)) : null,
      })),
      byStatus: byStatus.map((s: any) => ({
        statusCode: s.status_code,
        count: Number(s.count),
      })),
      topEndpoints: topEndpoints.map((e: any) => ({
        path: e.path,
        method: e.method,
        count: Number(e.count),
        avgDurationMs: e.avg_duration ? Math.round(Number(e.avg_duration)) : null,
        errorCount: Number(e.error_count),
      })),
    });
  } catch (error) {
    logger.error('Error getting summary:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

