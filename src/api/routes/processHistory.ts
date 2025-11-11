/**
 * API Endpoint: /process-history
 * 
 * Обработка операций из таблицы history
 * Вызывается из n8n workflow "History Matcher & Processor"
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import {
  processHistoryItem,
  markHistoryProcessed,
  type HistoryItem,
  type OperationMapping,
  type ProcessingResult
} from '../../services/historyProcessor';

const router = Router();

// =====================================================
// Типы запросов/ответов
// =====================================================

interface ProcessHistoryBatchRequest {
  limit?: number;
  operation_types?: string[];
  branch?: string;
}

interface ProcessHistoryBatchResponse {
  ok: boolean;
  processed: number;
  skipped: number;
  failed: number;
  results: Array<{
    history_id: number;
    operation_type: string;
    result: ProcessingResult;
  }>;
  errors?: string[];
}

// =====================================================
// Endpoint: POST /process-history
// =====================================================

/**
 * Пакетная обработка операций из history
 * 
 * Body:
 * {
 *   limit?: number,        // макс. кол-во операций (default: 100)
 *   operation_types?: [],  // фильтр по типам операций
 *   branch?: string        // фильтр по филиалу
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { limit = 100, operation_types, branch } = req.body as ProcessHistoryBatchRequest;
    
    console.log(`[Process History] Starting batch processing:`, {
      limit,
      operation_types,
      branch
    });
    
    // 1. Получить маппинги
    if (!db) {
      return res.status(500).json({ ok: false, error: 'Database not initialized' });
    }
    
    const mappings = await db.execute(sql`
      SELECT 
        id, operation_type, matched_event_type, is_webhook_event,
        target_table, processing_strategy, field_mappings,
        priority, enabled, notes
      FROM history_operation_mappings
      WHERE enabled = TRUE
      ORDER BY priority DESC
    `) as unknown as OperationMapping[];
    
    if (mappings.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No enabled mappings found. Please seed history_operation_mappings table.'
      });
    }
    
    const mappingsMap = new Map<string, OperationMapping>();
    for (const mapping of mappings) {
      mappingsMap.set(mapping.operation_type, mapping);
    }
    
    console.log(`[Process History] Loaded ${mappingsMap.size} mappings`);
    
    // 2. Получить необработанные операции из history (приоритетная очередь)
    let query = sql`
      SELECT 
        h.id, h.branch, h.operation_type, h.operation_id,
        h.description, h.entity_type, h.entity_id, h.user_name,
        h.created_at, h.raw_data, h.matched, h.processed
      FROM history h
      INNER JOIN history_operation_mappings m ON h.operation_type = m.operation_type
      WHERE h.processed = FALSE
        AND m.enabled = TRUE
        AND m.processing_strategy != 'skip'
    `;
    
    // Фильтры
    if (branch) {
      query = sql`${query} AND h.branch = ${branch}`;
    }
    if (operation_types && operation_types.length > 0) {
      query = sql`${query} AND h.operation_type = ANY(${operation_types})`;
    }
    
    // Сортировка по приоритету и времени
    query = sql`
      ${query}
      ORDER BY m.priority DESC, h.created_at ASC
      LIMIT ${limit}
    `;
    
    const historyItems = await db.execute(query) as unknown as HistoryItem[];
    
    if (historyItems.length === 0) {
      console.log(`[Process History] No pending operations found`);
      return res.json({
        ok: true,
        processed: 0,
        skipped: 0,
        failed: 0,
        results: []
      });
    }
    
    console.log(`[Process History] Found ${historyItems.length} pending operations`);
    
    // 3. Обработка каждой операции
    const results: ProcessHistoryBatchResponse['results'] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    
    for (const item of historyItems) {
      const mapping = mappingsMap.get(item.operation_type);
      
      if (!mapping) {
        errors.push(`No mapping for operation: ${item.operation_type}`);
        failedCount++;
        continue;
      }
      
      try {
        // Обработать операцию
        const result = await processHistoryItem(item, mapping);
        
        // Обновить статус в history
        const matched = mapping.is_webhook_event || false;
        await markHistoryProcessed(item.id, result, matched);
        
        results.push({
          history_id: item.id,
          operation_type: item.operation_type,
          result
        });
        
        if (result.ok) {
          if (result.action === 'skipped') {
            skippedCount++;
          } else {
            processedCount++;
          }
        } else {
          failedCount++;
          errors.push(`[${item.operation_type}] ${result.error}`);
        }
        
      } catch (error: any) {
        console.error(`[Process History] Error processing item ${item.id}:`, error);
        errors.push(`Item ${item.id}: ${error.message}`);
        failedCount++;
        
        // Помечаем как failed
        await markHistoryProcessed(item.id, {
          ok: false,
          action: 'processing_error',
          error: error.message
        });
      }
    }
    
    // 4. Обновить статистику в маппингах
    await db.execute(sql`
      UPDATE history_operation_mappings m
      SET 
        total_processed = (
          SELECT COUNT(*) 
          FROM history 
          WHERE operation_type = m.operation_type 
            AND processed = TRUE
        ),
        last_processed_at = NOW()
      WHERE enabled = TRUE
    `);
    
    console.log(`[Process History] Completed:`, {
      processed: processedCount,
      skipped: skippedCount,
      failed: failedCount
    });
    
    // 5. Ответ
    const response: ProcessHistoryBatchResponse = {
      ok: true,
      processed: processedCount,
      skipped: skippedCount,
      failed: failedCount,
      results
    };
    
    if (errors.length > 0) {
      response.errors = errors;
    }
    
    res.json(response);
    
  } catch (error: any) {
    console.error('[Process History] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// =====================================================
// Endpoint: GET /process-history/stats
// =====================================================

/**
 * Статистика обработки истории
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ ok: false, error: 'Database not initialized' });
    }
    
    // Статистика из view
    const stats = await db.execute(sql`
      SELECT * FROM history_processing_stats
      ORDER BY pending_count DESC, total_operations DESC
      LIMIT 50
    `) as unknown as Record<string, unknown>[];
    
    // Общая статистика
    const summary = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE processed = TRUE) as total_processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as total_pending,
        COUNT(*) FILTER (WHERE matched = TRUE) as total_matched,
        COUNT(DISTINCT operation_type) as unique_operation_types,
        COUNT(DISTINCT branch) as branches_count,
        MIN(created_at) as oldest_operation,
        MAX(created_at) as newest_operation
      FROM history
    `) as unknown as Record<string, unknown>[];
    
    res.json({
      ok: true,
      summary: summary[0],
      by_operation_type: stats
    });
    
  } catch (error: any) {
    console.error('[Process History Stats] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// =====================================================
// Endpoint: GET /process-history/unknown
// =====================================================

/**
 * Неизвестные типы операций (для incremental learning)
 */
router.get('/unknown', async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ ok: false, error: 'Database not initialized' });
    }
    
    const unknown = await db.execute(sql`
      SELECT * FROM unknown_operations
      ORDER BY frequency DESC
      LIMIT 20
    `) as unknown as Record<string, unknown>[];
    
    res.json({
      ok: true,
      unknown_operations: unknown,
      count: unknown.length
    });
    
  } catch (error: any) {
    console.error('[Process History Unknown] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// =====================================================
// Endpoint: POST /process-history/learn
// =====================================================

/**
 * Создать маппинг для неизвестного типа операции (incremental learning)
 * 
 * Body:
 * {
 *   operation_type: string,
 *   target_table: string,
 *   processing_strategy: string,
 *   field_mappings: object,
 *   priority?: number,
 *   notes?: string
 * }
 */
router.post('/learn', async (req: Request, res: Response) => {
  try {
    const {
      operation_type,
      target_table,
      processing_strategy,
      field_mappings,
      priority = 70,
      notes
    } = req.body;
    
    if (!operation_type || !target_table || !processing_strategy) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: operation_type, target_table, processing_strategy'
      });
    }
    
    if (!db) {
      return res.status(500).json({ ok: false, error: 'Database not initialized' });
    }
    
    // Создать новый маппинг
    await db.execute(sql`
      INSERT INTO history_operation_mappings (
        operation_type, target_table, processing_strategy,
        field_mappings, priority, notes, is_webhook_event
      ) VALUES (
        ${operation_type}, ${target_table}, ${processing_strategy},
        ${JSON.stringify(field_mappings)}::jsonb, ${priority}, ${notes}, FALSE
      )
      ON CONFLICT (operation_type) DO UPDATE SET
        target_table = EXCLUDED.target_table,
        processing_strategy = EXCLUDED.processing_strategy,
        field_mappings = EXCLUDED.field_mappings,
        priority = EXCLUDED.priority,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `);
    
    console.log(`[Process History Learn] Created mapping for: ${operation_type}`);
    
    res.json({
      ok: true,
      message: `Mapping created for ${operation_type}`,
      operation_type
    });
    
  } catch (error: any) {
    console.error('[Process History Learn] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

export default router;

