/**
 * Сервис для обработки history через триггеры БД
 * Слушает pg_notify и обрабатывает записи history
 */

import postgres from 'postgres';
import { logger } from '../utils/logger';
import { sendTelegramAlert } from '../integrations/n8n';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

let sql: postgres.Sql | null = null;
let listener: postgres.Sql | null = null;
let isListening = false;

/**
 * Инициализация слушателя pg_notify для history
 */
export async function startHistoryProcessor(): Promise<void> {
  if (isListening) {
    logger.warn('History processor already listening');
    return;
  }

  try {
    sql = postgres(CONNECTION_STRING, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      idle_timeout: 0,
    });

    // Подписываемся на уведомления
    await sql.unsafe('LISTEN history_item_processed');

    logger.info('✅ History processor started, listening for pg_notify events');

    // Обработчик уведомлений через отдельное соединение
    listener = postgres(CONNECTION_STRING, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      idle_timeout: 0,
    });

    // Слушаем уведомления
    listener.listen('history_item_processed', async (msg) => {
      try {
        await processHistoryNotification(msg.payload);
      } catch (error) {
        logger.error('Error processing history notification:', error);
      }
    });

    isListening = true;

    // Также запускаем периодическую проверку необработанных записей (fallback)
    setInterval(async () => {
      try {
        await processPendingHistory();
        await notifyHistoryErrors();
      } catch (error) {
        logger.error('Error processing pending history:', error);
        await sendHistoryProcessorAlert('❌ Ошибка резервной обработки history\n' + (error instanceof Error ? error.message : String(error)));
      }
    }, 60000); // Каждую минуту

  } catch (error) {
    logger.error('Failed to start history processor:', error);
    throw error;
  }
}

/**
 * Остановка слушателя
 */
export async function stopHistoryProcessor(): Promise<void> {
  if (listener) {
    await listener.unsafe('UNLISTEN history_item_processed');
    await listener.end();
    listener = null;
  }
  if (sql) {
    await sql.end();
    sql = null;
  }
  isListening = false;
  logger.info('History processor stopped');
}

/**
 * Обработка уведомления от триггера
 * Формат: history_id|branch|entity_type|entity_id
 */
async function processHistoryNotification(payload: string): Promise<void> {
  const parts = payload.split('|');
  if (parts.length !== 4) {
    logger.warn(`Invalid history notification format: ${payload}`);
    return;
  }

  const [historyIdStr, branch, entityType, entityId] = parts;
  const historyId = parseInt(historyIdStr, 10);

  if (isNaN(historyId)) {
    logger.warn(`Invalid history ID in notification: ${historyIdStr}`);
    return;
  }

  logger.debug(`Processing history ${historyId} from notification: ${branch}/${entityType}/${entityId}`);

  // Триггер уже обработал запись, просто логируем
  logger.debug(`[History ${historyId}] Processed by trigger: ${branch}/${entityType}/${entityId}`);
}

/**
 * Периодическая обработка необработанных записей (fallback)
 */
async function processPendingHistory(): Promise<void> {
  if (!sql) return;

  try {
    const records = await sql`
      SELECT * FROM get_pending_history_for_processing(50)
    `;

    if (records.length === 0) {
      return;
    }

    logger.debug(`Processing ${records.length} pending history records`);

    for (const record of records) {
      try {
        // Триггер обработает запись при UPDATE
        // Просто обновляем запись чтобы триггер сработал
        await sql`
          UPDATE history 
          SET notes = COALESCE(notes, '') || ' | Retry processing'
          WHERE id = ${record.id}
        `;
      } catch (error) {
        logger.error(`Error processing pending history ${record.id}:`, error);
        await sendHistoryProcessorAlert(`❌ Ошибка обработки history #${record.id}\n${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    logger.error('Error fetching pending history:', error);
    await sendHistoryProcessorAlert('❌ Ошибка выборки history для повторной обработки\n' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Проверка записей history с ошибками и отправка алерта
 */
async function notifyHistoryErrors(): Promise<void> {
  if (!sql) return;

  try {
    const records = await sql<{
      id: number;
      branch: string | null;
      operation_type: string | null;
      description: string | null;
      notes: string | null;
    }>`
      SELECT id, branch, operation_type, description, notes
      FROM history
      WHERE processed = FALSE
        AND notes IS NOT NULL
        AND notes <> ''
        AND (
          notes ILIKE '%ошиб%' OR
          notes ILIKE '%error%' OR
          notes ILIKE '%ambiguous%' OR
          notes ILIKE '%не удалось%'
        )
        AND notes NOT ILIKE '%[telegram_alert]%'
      ORDER BY ts DESC
      LIMIT 5
    `;

    if (records.length === 0) {
      return;
    }

    const header = '🚨 History auto-processor обнаружил ошибки';
    const body = records
      .map((rec) => {
        const branch = rec.branch ?? 'unknown';
        const opType = rec.operation_type ?? 'unknown';
        const description = rec.description ?? '(нет описания)';
        const notes = rec.notes ?? '';
        return `#${rec.id} | ${branch} | ${opType}\n${description}\n${notes}`;
      })
      .join('\n\n');

    await sendHistoryProcessorAlert(`${header}\n\n${body}`);

    const ids = records.map((rec) => rec.id);
    await sql`
      UPDATE history
      SET notes = COALESCE(notes, '') || ' | [telegram_alert]'
      WHERE id = ANY(${ids})
    `;
  } catch (error) {
    logger.error('Error sending history processor alert:', error);
  }
}

async function sendHistoryProcessorAlert(message: string): Promise<void> {
  try {
    await sendTelegramAlert(message);
  } catch (alertError) {
    logger.error('Failed to send Telegram alert for history processor:', alertError);
  }
}

