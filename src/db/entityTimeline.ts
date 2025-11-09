/**
 * Entity Timeline - функции для записи в денормализованный лог событий
 * 
 * Универсальная таблица для хранения временной линии всех событий по сущностям
 */

import { getDatabase } from './index';
import { entityTimeline, type EntityTimeline, type EntityTimelineInsert } from './schema';
import { sql } from 'drizzle-orm';
import type { BranchName } from '../integrations/rentprog';

// Типы для записи в timeline
export type TimelineSourceType = 
  | 'rentprog_webhook' 
  | 'rentprog_history' 
  | 'starline' 
  | 'telegram' 
  | 'manual' 
  | 'system';

export type TimelineEntityType = 
  | 'car' 
  | 'booking' 
  | 'client' 
  | 'employee' 
  | 'payment' 
  | 'branch';

export type TimelineOperation = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'move' 
  | 'status_change';

export interface TimelineEntry {
  entityType: TimelineEntityType;
  entityId: string; // UUID
  sourceType: TimelineSourceType;
  sourceId?: string; // ID из исходной таблицы
  eventType: string; // 'booking.created', 'car.gps_updated', etc
  operation?: TimelineOperation;
  summary?: string;
  details?: Record<string, unknown>;
  branchCode?: string;
  userName?: string;
  confidence?: 'high' | 'medium' | 'low';
  relatedEntities?: Array<{ type: TimelineEntityType; id: string }>;
  ts?: Date; // Время события (по умолчанию now())
}

/**
 * Записать событие в timeline
 */
export async function addToTimeline(entry: TimelineEntry): Promise<number> {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not available');
  }

  const [result] = await db.insert(entityTimeline).values({
    ts: entry.ts || new Date(),
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    source_type: entry.sourceType,
    source_id: entry.sourceId || null,
    event_type: entry.eventType,
    operation: entry.operation || null,
    summary: entry.summary || null,
    details: entry.details ? entry.details : null,
    branch_code: entry.branchCode || null,
    user_name: entry.userName || null,
    confidence: entry.confidence || null,
    related_entities: entry.relatedEntities ? entry.relatedEntities : null,
  }).returning({ id: entityTimeline.id });

  return result.id;
}

/**
 * Получить timeline для сущности
 */
export async function getTimelineForEntity(
  entityType: TimelineEntityType,
  entityId: string,
  options: {
    limit?: number;
    offset?: number;
    eventTypes?: string[];
    sourceTypes?: TimelineSourceType[];
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<EntityTimeline[]> {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not available');
  }

  const {
    limit = 100,
    offset = 0,
    eventTypes = [],
    sourceTypes = [],
    startDate,
    endDate,
  } = options;

  let query = sql`
    SELECT * FROM entity_timeline
    WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
  `;

  if (eventTypes.length > 0) {
    query = sql`${query} AND event_type = ANY(${eventTypes})`;
  }

  if (sourceTypes.length > 0) {
    query = sql`${query} AND source_type = ANY(${sourceTypes})`;
  }

  if (startDate) {
    query = sql`${query} AND ts >= ${startDate}`;
  }

  if (endDate) {
    query = sql`${query} AND ts <= ${endDate}`;
  }

  query = sql`${query} ORDER BY ts DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await db.execute(query);
  return result as any[];
}

/**
 * Получить timeline для нескольких сущностей (например, все события по брони и связанным сущностям)
 */
export async function getTimelineForRelatedEntities(
  entities: Array<{ type: TimelineEntityType; id: string }>,
  options: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<EntityTimeline[]> {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not available');
  }

  const { limit = 100, offset = 0, startDate, endDate } = options;

  // Строим условия для каждой сущности
  const conditions = entities.map(
    (e, i) => sql`(entity_type = ${e.type} AND entity_id = ${e.id})`
  );

  let query = sql`
    SELECT * FROM entity_timeline
    WHERE (${sql.join(conditions, sql` OR `)})
  `;

  if (startDate) {
    query = sql`${query} AND ts >= ${startDate}`;
  }

  if (endDate) {
    query = sql`${query} AND ts <= ${endDate}`;
  }

  query = sql`${query} ORDER BY ts DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await db.execute(query);
  return result as any[];
}

/**
 * Получить статистику по timeline
 */
export async function getTimelineStats(options: {
  entityType?: TimelineEntityType;
  branchCode?: string;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<any[]> {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not available');
  }

  const { entityType, branchCode, startDate, endDate } = options;

  let query = sql`
    SELECT 
      entity_type,
      event_type,
      source_type,
      operation,
      COUNT(*) as total_events,
      COUNT(DISTINCT entity_id) as unique_entities,
      MIN(ts) as first_event,
      MAX(ts) as last_event
    FROM entity_timeline
    WHERE 1=1
  `;

  if (entityType) {
    query = sql`${query} AND entity_type = ${entityType}`;
  }

  if (branchCode) {
    query = sql`${query} AND branch_code = ${branchCode}`;
  }

  if (startDate) {
    query = sql`${query} AND ts >= ${startDate}`;
  }

  if (endDate) {
    query = sql`${query} AND ts <= ${endDate}`;
  }

  query = sql`${query} 
    GROUP BY entity_type, event_type, source_type, operation
    ORDER BY total_events DESC
  `;

  const result = await db.execute(query);
  return result as any[];
}

/**
 * Вспомогательные функции для создания записей timeline из разных источников
 */

/**
 * Записать событие платежа в timeline
 */
export async function addPaymentToTimeline(
  paymentId: string,
  branch: BranchName,
  paymentData: {
    amount: string;
    currency: string;
    description?: string;
    bookingId?: string;
    clientId?: string;
    employeeId?: string;
  }
): Promise<number> {
  const relatedEntities: Array<{ type: TimelineEntityType; id: string }> = [];
  if (paymentData.bookingId) {
    relatedEntities.push({ type: 'booking', id: paymentData.bookingId });
  }
  if (paymentData.clientId) {
    relatedEntities.push({ type: 'client', id: paymentData.clientId });
  }
  if (paymentData.employeeId) {
    relatedEntities.push({ type: 'employee', id: paymentData.employeeId });
  }

  return addToTimeline({
    entityType: 'payment',
    entityId: paymentId,
    sourceType: 'rentprog_history',
    sourceId: paymentId,
    eventType: 'payment.received',
    operation: 'create',
    summary: `Платеж ${paymentData.amount} ${paymentData.currency}${paymentData.description ? `: ${paymentData.description}` : ''}`,
    details: {
      amount: paymentData.amount,
      currency: paymentData.currency,
      description: paymentData.description,
    },
    branchCode: branch,
    confidence: 'high',
    relatedEntities: relatedEntities.length > 0 ? relatedEntities : undefined,
  });
}

/**
 * Записать событие GPS обновления в timeline
 */
export async function addGPSToTimeline(
  carId: string,
  gpsData: {
    lat: number;
    lng: number;
    isMoving: boolean;
    distance?: number;
    speed?: number;
    branchCode?: string;
  }
): Promise<number> {
  return addToTimeline({
    entityType: 'car',
    entityId: carId,
    sourceType: 'starline',
    eventType: 'car.gps_updated',
    operation: 'update',
    summary: gpsData.isMoving 
      ? `Авто движется: ${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)}`
      : `Авто на месте: ${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)}`,
    details: {
      lat: gpsData.lat,
      lng: gpsData.lng,
      isMoving: gpsData.isMoving,
      distance: gpsData.distance,
      speed: gpsData.speed,
    },
    branchCode: gpsData.branchCode,
    confidence: 'high',
  });
}

/**
 * Записать событие вебхука в timeline
 */
export async function addWebhookToTimeline(
  entityType: TimelineEntityType,
  entityId: string,
  eventData: {
    eventType: string;
    operation: TimelineOperation;
    summary?: string;
    details?: Record<string, unknown>;
    branchCode?: string;
    sourceId?: string;
    relatedEntities?: Array<{ type: TimelineEntityType; id: string }>;
  }
): Promise<number> {
  return addToTimeline({
    entityType,
    entityId,
    sourceType: 'rentprog_webhook',
    sourceId: eventData.sourceId,
    eventType: eventData.eventType,
    operation: eventData.operation,
    summary: eventData.summary,
    details: eventData.details,
    branchCode: eventData.branchCode,
    confidence: 'high',
    relatedEntities: eventData.relatedEntities,
  });
}

