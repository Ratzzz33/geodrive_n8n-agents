/**
 * Модуль архивации сущностей
 */

import { logger } from '../utils/logger';
import { getDatabase } from './index';

/**
 * Архивирует сущность (устанавливает archived = true)
 */
export async function archiveEntity(
  entityType: string,
  entityId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Определяем таблицу по типу сущности
    const table = getTableName(entityType);
    
    if (!table) {
      logger.error(`Unknown entity type: ${entityType}`);
      return { ok: false, error: `Unknown entity type: ${entityType}` };
    }
    
    // TODO: Реализовать через Drizzle ORM
    // Пока возвращаем заглушку
    logger.warn(`Archive not implemented yet for ${entityType} ${entityId}`);
    
    return { ok: true };
  } catch (error) {
    logger.error(`Error archiving ${entityType} ${entityId}:`, error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Определяет имя таблицы по типу сущности
 */
function getTableName(entityType: string): string | null {
  const tables: Record<string, string> = {
    'car': 'cars',
    'booking': 'bookings',
    'client': 'clients',
    'branch': 'branches',
    'employee': 'employees'
  };
  
  return tables[entityType] || null;
}

