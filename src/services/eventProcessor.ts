/**
 * Сервис для обработки событий через триггеры БД
 * Слушает pg_notify и обрабатывает события через Jarvis API
 */

import postgres from 'postgres';
import { getDatabase } from '../db';
import { handleRentProgEvent } from '../orchestrator/rentprog-handler';
import { normalizeRentProgWebhook } from '../integrations/rentprog-webhook-parser';
import { logger } from '../utils/logger';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

let sql: postgres.Sql | null = null;
let listener: postgres.Sql | null = null;
let isListening = false;

/**
 * Инициализация слушателя pg_notify
 */
export async function startEventProcessor(): Promise<void> {
  if (isListening) {
    logger.warn('Event processor already listening');
    return;
  }

  try {
    sql = postgres(CONNECTION_STRING, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      idle_timeout: 0, // Keep connection alive
    });

    // Подписываемся на уведомления
    await sql.unsafe('LISTEN rentprog_event_auto_process');

    logger.info('✅ Event processor started, listening for pg_notify events');

    // Обработчик уведомлений через отдельное соединение
    listener = postgres(CONNECTION_STRING, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      idle_timeout: 0,
    });

    // Слушаем уведомления
    listener.listen('rentprog_event_auto_process', async (msg) => {
      try {
        await processEventNotification(msg.payload);
      } catch (error) {
        logger.error('Error processing event notification:', error);
      }
    });

    isListening = true;

    // Также запускаем периодическую проверку необработанных событий (fallback)
    setInterval(async () => {
      try {
        await processPendingEvents();
      } catch (error) {
        logger.error('Error processing pending events:', error);
      }
    }, 30000); // Каждые 30 секунд

  } catch (error) {
    logger.error('Failed to start event processor:', error);
    throw error;
  }
}

/**
 * Остановка слушателя
 */
export async function stopEventProcessor(): Promise<void> {
  if (listener) {
    await listener.unsafe('UNLISTEN rentprog_event_auto_process');
    await listener.end();
    listener = null;
  }
  if (sql) {
    await sql.end();
    sql = null;
  }
  isListening = false;
  logger.info('Event processor stopped');
}

/**
 * Обработка уведомления от триггера
 * Формат: event_id|branch|type|ext_id
 */
async function processEventNotification(payload: string): Promise<void> {
  const parts = payload.split('|');
  if (parts.length !== 4) {
    logger.warn(`Invalid notification format: ${payload}`);
    return;
  }

  const [eventIdStr, branch, type, extId] = parts;
  const eventId = parseInt(eventIdStr, 10);

  if (isNaN(eventId)) {
    logger.warn(`Invalid event ID in notification: ${eventIdStr}`);
    return;
  }

  logger.debug(`Processing event ${eventId} from notification: ${branch}/${type}/${extId}`);

  try {
    await processEvent(eventId, branch, type, extId);
  } catch (error) {
    logger.error(`Error processing event ${eventId}:`, error);
    // При ошибке событие остается необработанным (processed = false)
    await markEventError(eventId, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Периодическая обработка необработанных событий (fallback)
 */
async function processPendingEvents(): Promise<void> {
  if (!sql) return;

  try {
    const events = await sql`
      SELECT * FROM get_pending_events_for_processing(50)
    `;

    if (events.length === 0) {
      return;
    }

    logger.debug(`Processing ${events.length} pending events`);

    for (const event of events) {
      try {
        await processEvent(event.id, event.branch, event.type, event.ext_id);
      } catch (error) {
        logger.error(`Error processing pending event ${event.id}:`, error);
        await markEventError(event.id, error instanceof Error ? error.message : String(error));
      }
    }
  } catch (error) {
    logger.error('Error fetching pending events:', error);
  }
}

/**
 * Обработка одного события
 */
async function processEvent(eventId: number, branch: string, type: string, extId: string): Promise<void> {
  logger.debug(`[Event ${eventId}] Processing: ${branch}/${type}/${extId}`);

  try {
    // Создаем системное событие
    const systemEvent = normalizeRentProgWebhook({
      event: type,
      id: extId,
      payload: { id: extId },
    });

    // Обрабатываем через handleRentProgEvent
    const result = await handleRentProgEvent(systemEvent, eventId);

    if (result.ok) {
      // Помечаем как успешно обработанное
      await markEventSuccess(eventId);
      logger.debug(`[Event ${eventId}] Successfully processed`);
    } else {
      // При ошибке оставляем необработанным
      await markEventError(eventId, result.error || 'Unknown error');
      logger.warn(`[Event ${eventId}] Processing failed: ${result.error}`);
    }
  } catch (error) {
    // При ошибке оставляем необработанным
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markEventError(eventId, errorMessage);
    logger.error(`[Event ${eventId}] Processing error:`, error);
    throw error;
  }
}

/**
 * Пометить событие как успешно обработанное
 */
async function markEventSuccess(eventId: number): Promise<void> {
  if (!sql) return;

  try {
    await sql`
      SELECT mark_event_processed(${eventId}, TRUE, NULL)
    `;
  } catch (error) {
    logger.error(`Error marking event ${eventId} as success:`, error);
  }
}

/**
 * Пометить событие как ошибку (но оставить необработанным)
 */
async function markEventError(eventId: number, reason: string): Promise<void> {
  if (!sql) return;

  try {
    await sql`
      SELECT mark_event_processed(${eventId}, FALSE, ${reason.substring(0, 500)})
    `;
  } catch (error) {
    logger.error(`Error marking event ${eventId} as error:`, error);
  }
}

