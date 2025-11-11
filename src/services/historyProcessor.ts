/**
 * History Processor - Обработка операций из таблицы history
 * 
 * Этот модуль отвечает за:
 * 1. Извлечение данных из raw_data операций
 * 2. Маппинг на целевые таблицы (payments, cars, bookings, etc)
 * 3. Обновление статусов обработки
 * 4. Ведение журнала изменений (history_log)
 */

import { db } from '../db';
import { 
  cars, 
  bookings, 
  clients, 
  employees, 
  payments,
  externalRefs 
} from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { Branch } from '../db/schema';

// =====================================================
// Типы
// =====================================================

export interface HistoryItem {
  id: number;
  branch: string;
  operation_type: string;
  operation_id: string | null;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  user_name: string | null;
  created_at: Date;
  raw_data: string; // JSON string
  matched: boolean;
  processed: boolean;
}

export interface OperationMapping {
  id: number;
  operation_type: string;
  matched_event_type: string | null;
  is_webhook_event: boolean;
  target_table: string;
  processing_strategy: string;
  field_mappings: Record<string, string>;
  priority: number;
  enabled: boolean;
  notes: string | null;
}

export interface ProcessingResult {
  ok: boolean;
  action: string;
  entityId?: string;
  error?: string;
  details?: Record<string, unknown>;
}

// =====================================================
// Утилиты для извлечения данных
// =====================================================

/**
 * Извлекает значение из raw_data по JSONPath
 */
function extractField(rawData: Record<string, unknown>, path: string): unknown {
  // Простой JSONPath: $.field или $.nested.field
  if (!path.startsWith('$.')) {
    return undefined;
  }
  
  const parts = path.substring(2).split('.');
  let current: any = rawData;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

/**
 * Применяет field_mappings к raw_data
 */
function applyFieldMappings(
  rawData: Record<string, unknown>,
  fieldMappings: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [targetField, sourcePath] of Object.entries(fieldMappings)) {
    const value = extractField(rawData, sourcePath);
    if (value !== undefined) {
      result[targetField] = value;
    }
  }
  
  return result;
}

/**
 * Поиск UUID сущности по external_id из RentProg
 */
async function findEntityByRpId(
  entityType: 'car' | 'client' | 'booking' | 'employee',
  rpId: string,
  branch?: string
): Promise<string | null> {
  if (!db) {
    return null;
  }
  
  const query = db.select({ entity_id: externalRefs.entity_id })
    .from(externalRefs)
    .where(
      and(
        eq(externalRefs.system, 'rentprog'),
        eq(externalRefs.entity_type, entityType),
        eq(externalRefs.external_id, rpId),
        branch ? eq(externalRefs.branch_code, branch) : undefined
      )
    )
    .limit(1);
  
  const result = await query;
  return result[0]?.entity_id || null;
}

// =====================================================
// Стратегии обработки
// =====================================================

/**
 * Стратегия: extract_payment
 * Извлекает платёж из истории и сохраняет в payments
 */
export async function extractPayment(
  item: HistoryItem,
  mapping: OperationMapping
): Promise<ProcessingResult> {
  try {
    const rawData = JSON.parse(item.raw_data);
    const extracted = applyFieldMappings(rawData, mapping.field_mappings);
    
    // Подготовка данных платежа
    const paymentData: any = {
      branch: item.branch,
      payment_date: new Date(extracted.payment_date as string || item.created_at),
      payment_type: (extracted.payment_type as string) || 'other',
      payment_method: (extracted.payment_method as string) || 'cash',
      amount: String(extracted.amount || 0),
      currency: (extracted.currency as string) || 'GEL',
      description: (extracted.description as string) || item.description,
      rp_payment_id: extracted.rp_payment_id ? Number(extracted.rp_payment_id) : null,
      rp_client_id: extracted.rp_client_id ? Number(extracted.rp_client_id) : null,
      rp_car_id: extracted.rp_car_id ? Number(extracted.rp_car_id) : null,
      rp_user_id: extracted.rp_user_id ? Number(extracted.rp_user_id) : null,
    };
    
    // Попытка найти связанные сущности через external_refs
    if (paymentData.rp_client_id) {
      const clientId = await findEntityByRpId('client', String(paymentData.rp_client_id));
      if (clientId) {
        paymentData.client_id = clientId;
      }
    }
    
    if (!db) {
      return {
        ok: false,
        action: 'database_error',
        error: 'Database not initialized'
      };
    }
    
    // Upsert платежа
    const result = await db.insert(payments)
      .values(paymentData)
      .onConflictDoUpdate({
        target: [payments.rp_payment_id],
        set: {
          amount: paymentData.amount,
          description: paymentData.description,
          updated_at: new Date()
        }
      })
      .returning({ id: payments.id });
    
    const paymentId = result[0].id;
    
    // Автоматически связать с events и history (если еще не связано)
    if (paymentData.rp_payment_id) {
      try {
        const { linkPayment, getLinksForPayment } = await import('../db/eventLinks');
        
        // Проверить, есть ли уже связи
        const existingLinks = await getLinksForPayment(paymentId);
        
        // Если нет связей, попробуем связать
        if (existingLinks.length === 0) {
          await linkPayment(
            paymentId,
            item.branch as any,
            Number(paymentData.rp_payment_id),
            paymentData.payment_date,
            { timeWindowSeconds: 300, autoCreate: true }
          );
        }
      } catch (linkError) {
        // Не критично, если связывание не удалось - логируем и продолжаем
        console.warn('Failed to link payment from history:', linkError);
      }
    }
    
    // Записать в timeline (для всех платежей, проверяем дубликаты)
    try {
      const { addPaymentToTimeline } = await import('../db/entityTimeline');
      
      if (!db) {
        throw new Error('Database not initialized');
      }
      
      // Проверить, есть ли уже в timeline
      const existingTimeline = await db.execute(sql`
        SELECT id FROM entity_timeline
        WHERE entity_type = 'payment'
          AND entity_id = ${paymentId}
        LIMIT 1
      `);
      
      if (!existingTimeline || existingTimeline.length === 0) {
        // Найти client_id если есть
        let clientId: string | undefined;
        if (paymentData.rp_client_id) {
          const clientIdResult = await findEntityByRpId('client', String(paymentData.rp_client_id));
          if (clientIdResult) {
            clientId = clientIdResult;
          }
        }
        
        // Найти booking_id если есть в rawData
        let bookingId: string | undefined;
        if (rawData.booking_id) {
          const bookingIdResult = await findEntityByRpId('booking', String(rawData.booking_id));
          if (bookingIdResult) {
            bookingId = bookingIdResult;
          }
        }
        
        await addPaymentToTimeline(
          paymentId,
          item.branch as any,
          {
            amount: paymentData.amount,
            currency: paymentData.currency || 'GEL',
            description: paymentData.description || item.description,
            bookingId,
            clientId,
            employeeId: undefined,
          }
        );
      }
    } catch (timelineError) {
      // Не критично, если запись в timeline не удалась - логируем и продолжаем
      console.warn('Failed to add payment to timeline from history:', timelineError);
    }
    
    return {
      ok: true,
      action: 'payment_saved',
      entityId: paymentId,
      details: { payment_type: paymentData.payment_type, amount: paymentData.amount }
    };
    
  } catch (error: any) {
    return {
      ok: false,
      action: 'payment_extraction_failed',
      error: error.message
    };
  }
}

/**
 * Стратегия: update_employee_cash
 * Обновляет остаток кассы сотрудника
 */
export async function updateEmployeeCash(
  item: HistoryItem,
  mapping: OperationMapping
): Promise<ProcessingResult> {
  try {
    const rawData = JSON.parse(item.raw_data);
    const extracted = applyFieldMappings(rawData, mapping.field_mappings);
    
    const employeeRpId = String(extracted.employee_rp_id);
    const amount = Number(extracted.amount || 0);
    const currency = (extracted.currency as string) || 'GEL';
    const operation = (extracted.operation as string) || 'collect'; // collect | adjust
    
    // Найти сотрудника
    const employeeId = await findEntityByRpId('employee', employeeRpId, item.branch);
    
    if (!employeeId) {
      return {
        ok: false,
        action: 'employee_not_found',
        error: `Employee not found: rp_id=${employeeRpId}`
      };
    }
    
    if (!db) {
      return {
        ok: false,
        action: 'database_error',
        error: 'Database not initialized'
      };
    }
    
    // Обновляем через SQL (поля могут отсутствовать в схеме drizzle)
    const cashField = currency === 'USD' ? 'cash_usd' 
                    : currency === 'EUR' ? 'cash_eur' 
                    : 'cash_gel';
    
    const updateValue = operation === 'collect'
      ? sql`COALESCE(${sql.identifier(cashField)}, 0) - ${amount}`
      : sql`${amount}`;
    
    await db.execute(sql`
      UPDATE employees
      SET 
        ${sql.identifier(cashField)} = ${updateValue},
        cash_last_updated = NOW(),
        history_log = COALESCE(history_log, '[]'::jsonb) || 
          ${JSON.stringify([{
            ts: new Date().toISOString(),
            source: 'history',
            operation_type: item.operation_type,
            operation,
            amount,
            currency,
            description: item.description,
            history_id: item.id
          }])}::jsonb,
        updated_at = NOW()
      WHERE id = ${employeeId}
    `);
    
    return {
      ok: true,
      action: 'employee_cash_updated',
      entityId: employeeId,
      details: { operation, amount, currency }
    };
    
  } catch (error: any) {
    return {
      ok: false,
      action: 'cash_update_failed',
      error: error.message
    };
  }
}

/**
 * Стратегия: add_maintenance_note
 * Добавляет запись о техобслуживании в history_log автомобиля
 */
export async function addMaintenanceNote(
  item: HistoryItem,
  mapping: OperationMapping
): Promise<ProcessingResult> {
  try {
    const rawData = JSON.parse(item.raw_data);
    const extracted = applyFieldMappings(rawData, mapping.field_mappings);
    
    const carRpId = String(extracted.car_rp_id || item.entity_id);
    
    // Найти автомобиль
    const carId = await findEntityByRpId('car', carRpId, item.branch);
    
    if (!carId) {
      return {
        ok: false,
        action: 'car_not_found',
        error: `Car not found: rp_id=${carRpId}`
      };
    }
    
    // Подготовить запись для history_log
    const logEntry = {
      ts: new Date(extracted.created_at as string || item.created_at).toISOString(),
      source: 'history',
      operation_type: item.operation_type,
      description: (extracted.description as string) || item.description,
      cost: extracted.cost ? Number(extracted.cost) : undefined,
      mileage: extracted.mileage ? Number(extracted.mileage) : undefined,
      user_name: item.user_name,
      history_id: item.id
    };
    
    // Добавить в history_log через SQL
    if (!db) {
      return {
        ok: false,
        action: 'database_error',
        error: 'Database not initialized'
      };
    }
    
    await db.execute(sql`
      UPDATE cars
      SET 
        history_log = COALESCE(history_log, '[]'::jsonb) || 
          ${JSON.stringify([logEntry])}::jsonb,
        updated_at = NOW()
      WHERE id = ${carId}
    `);
    
    return {
      ok: true,
      action: 'maintenance_note_added',
      entityId: carId,
      details: { cost: logEntry.cost, mileage: logEntry.mileage }
    };
    
  } catch (error: any) {
    return {
      ok: false,
      action: 'maintenance_note_failed',
      error: error.message
    };
  }
}

/**
 * Стратегия: update_car_status
 * Обновляет статус автомобиля
 */
export async function updateCarStatus(
  item: HistoryItem,
  mapping: OperationMapping
): Promise<ProcessingResult> {
  try {
    const rawData = JSON.parse(item.raw_data);
    const extracted = applyFieldMappings(rawData, mapping.field_mappings);
    
    const carRpId = String(extracted.car_rp_id || item.entity_id);
    const status = extracted.status as string;
    
    // Найти автомобиль
    const carId = await findEntityByRpId('car', carRpId, item.branch);
    
    if (!carId) {
      return {
        ok: false,
        action: 'car_not_found',
        error: `Car not found: rp_id=${carRpId}`
      };
    }
    
    // Обновить статус и добавить в history_log через SQL
    if (!db) {
      return {
        ok: false,
        action: 'database_error',
        error: 'Database not initialized'
      };
    }
    
    await db.execute(sql`
      UPDATE cars
      SET 
        data = jsonb_set(
          COALESCE(data, '{}'::jsonb),
          '{status}',
          ${JSON.stringify(status)}::jsonb
        ),
        history_log = COALESCE(history_log, '[]'::jsonb) || 
          ${JSON.stringify([{
            ts: new Date().toISOString(),
            source: 'history',
            operation_type: item.operation_type,
            status,
            reason: extracted.reason || item.description,
            history_id: item.id
          }])}::jsonb,
        updated_at = NOW()
      WHERE id = ${carId}
    `);
    
    return {
      ok: true,
      action: 'car_status_updated',
      entityId: carId,
      details: { status }
    };
    
  } catch (error: any) {
    return {
      ok: false,
      action: 'car_status_update_failed',
      error: error.message
    };
  }
}

/**
 * Стратегия: update_booking_status
 * Обновляет статус брони и связанные поля
 */
export async function updateBookingStatus(
  item: HistoryItem,
  mapping: OperationMapping
): Promise<ProcessingResult> {
  try {
    const rawData = JSON.parse(item.raw_data);
    const extracted = applyFieldMappings(rawData, mapping.field_mappings);
    
    const bookingRpId = String(extracted.booking_rp_id || item.entity_id);
    
    // Найти бронь
    const bookingId = await findEntityByRpId('booking', bookingRpId, item.branch);
    
    if (!bookingId) {
      return {
        ok: false,
        action: 'booking_not_found',
        error: `Booking not found: rp_id=${bookingRpId}`
      };
    }
    
    if (!db) {
      return {
        ok: false,
        action: 'database_error',
        error: 'Database not initialized'
      };
    }
    
    // Обновить через SQL (history_log может отсутствовать в схеме)
    const statusValue = extracted.status as string;
    const logEntry = {
      ts: new Date().toISOString(),
      source: 'history',
      operation_type: item.operation_type,
      ...extracted,
      history_id: item.id
    };
    
    // Строим динамический SQL
    const bookingUpdates: any = {
      status: statusValue,
      updated_at: new Date()
    };
    
    if (extracted.issue_planned_at) bookingUpdates.issue_planned = new Date(extracted.issue_planned_at as string);
    if (extracted.issue_actual_at) bookingUpdates.issue_actual = new Date(extracted.issue_actual_at as string);
    if (extracted.return_planned_at) bookingUpdates.return_planned = new Date(extracted.return_planned_at as string);
    if (extracted.return_actual_at) bookingUpdates.return_actual = new Date(extracted.return_actual_at as string);
    if (extracted.mileage_start) bookingUpdates.mileage_start = Number(extracted.mileage_start);
    if (extracted.mileage_end) bookingUpdates.mileage_end = Number(extracted.mileage_end);
    if (extracted.fuel_start) bookingUpdates.fuel_start = Number(extracted.fuel_start);
    if (extracted.fuel_end) bookingUpdates.fuel_end = Number(extracted.fuel_end);
    
    // Обновляем основные поля через drizzle
    await db.update(bookings)
      .set(bookingUpdates)
      .where(eq(bookings.id, bookingId));
    
    // Обновляем history_log отдельным запросом (если поле существует в БД)
    try {
      const logEntryJson = JSON.stringify([logEntry]).replace(/'/g, "''");
      await db.execute(sql.raw(`
        UPDATE bookings
        SET history_log = COALESCE(history_log, '[]'::jsonb) || '${logEntryJson}'::jsonb
        WHERE id = '${bookingId}'
      `));
    } catch (e) {
      // Игнорируем ошибку если поле history_log не существует
      console.warn('history_log field may not exist in bookings table');
    }
    
    return {
      ok: true,
      action: 'booking_status_updated',
      entityId: bookingId,
      details: { status: bookingUpdates.status }
    };
    
  } catch (error: any) {
    return {
      ok: false,
      action: 'booking_update_failed',
      error: error.message
    };
  }
}

// =====================================================
// Главная функция обработки
// =====================================================

/**
 * Обработать одну операцию из history
 */
export async function processHistoryItem(
  item: HistoryItem,
  mapping: OperationMapping
): Promise<ProcessingResult> {
  // Skip обработка
  if (mapping.processing_strategy === 'skip') {
    return {
      ok: true,
      action: 'skipped',
      details: { reason: mapping.notes || 'Marked as skip' }
    };
  }
  
  // Роутинг по стратегии
  switch (mapping.processing_strategy) {
    case 'extract_payment':
      return await extractPayment(item, mapping);
    
    case 'update_employee_cash':
    case 'cashbox_transfer':
      return await updateEmployeeCash(item, mapping);
    
    case 'add_maintenance_note':
      return await addMaintenanceNote(item, mapping);
    
    case 'update_car_status':
    case 'update_car_location':
      return await updateCarStatus(item, mapping);
    
    case 'update_booking_status':
      return await updateBookingStatus(item, mapping);
    
    default:
      return {
        ok: false,
        action: 'unknown_strategy',
        error: `Unknown processing strategy: ${mapping.processing_strategy}`
      };
  }
}

/**
 * Обновить статус обработки в history
 */
export async function markHistoryProcessed(
  historyId: number,
  result: ProcessingResult,
  matched: boolean = false
): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  const notes = result.ok
    ? `✅ ${result.action}: ${JSON.stringify(result.details || {})}`
    : `❌ ${result.action}: ${result.error}`;
  
  await db.execute(sql`
    UPDATE history
    SET 
      processed = ${result.ok},
      matched = ${matched},
      notes = ${notes}
    WHERE id = ${historyId}
  `);
}

