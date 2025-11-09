/**
 * Event Links - Автоматическое связывание events, payments и history
 * 
 * Связывает одни и те же процессы из разных источников данных:
 * - events (вебхуки) - события в реальном времени
 * - payments (платежи) - разложенные финансовые данные
 * - history (история) - полный лог операций
 */

import { getDatabase } from './index';
import { eventLinks, payments, externalRefs, type EventLink } from './schema';
import { eq, and, sql, or, isNull, isNotNull } from 'drizzle-orm';
import type { BranchName } from '../integrations/rentprog';

// =====================================================
// Типы
// =====================================================

export interface LinkResult {
  created: boolean;
  linkId: string | null;
  eventId: number | null;
  historyId: number | null;
  linkType: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LinkOptions {
  timeWindowSeconds?: number; // Окно времени для поиска (по умолчанию 300 = 5 минут)
  autoCreate?: boolean; // Автоматически создавать связь (по умолчанию true)
}

// =====================================================
// Вспомогательные функции
// =====================================================

/**
 * Получить company_id филиала из кода
 */
async function getCompanyId(branchCode: BranchName): Promise<number | null> {
  const companyIdMap: Record<BranchName, number> = {
    'tbilisi': 9247,
    'batumi': 9248,
    'kutaisi': 9506,
    'service-center': 11163,
  };
  
  return companyIdMap[branchCode] || null;
}

/**
 * Вычислить уверенность в связи на основе совпадений
 */
function calculateConfidence(
  hasEvent: boolean,
  hasHistory: boolean,
  timeDiff: number | null,
  idMatch: boolean
): 'high' | 'medium' | 'low' {
  if (idMatch && timeDiff !== null && timeDiff < 60) {
    return 'high'; // Точное совпадение ID и времени (< 1 минуты)
  }
  
  if (hasEvent && hasHistory && timeDiff !== null && timeDiff < 300) {
    return 'high'; // Оба источника и время близко
  }
  
  if ((hasEvent || hasHistory) && timeDiff !== null && timeDiff < 300) {
    return 'medium'; // Один источник и время близко
  }
  
  if (hasEvent || hasHistory) {
    return 'medium'; // Есть хотя бы один источник
  }
  
  return 'low'; // Предположение
}

/**
 * Определить тип связи
 */
function determineLinkType(
  hasEvent: boolean,
  hasHistory: boolean
): 'webhook_to_payment' | 'history_to_payment' | 'webhook_to_history' | 'all' {
  if (hasEvent && hasHistory) return 'all';
  if (hasEvent) return 'webhook_to_payment';
  if (hasHistory) return 'history_to_payment';
  return 'webhook_to_payment'; // По умолчанию
}

// =====================================================
// Основные функции
// =====================================================

/**
 * Связать платеж с событиями и историей
 */
export async function linkPayment(
  paymentId: string,
  branch: BranchName,
  rpPaymentId: number,
  paymentDate: Date,
  options: LinkOptions = {}
): Promise<LinkResult> {
  const {
    timeWindowSeconds = 300, // 5 минут по умолчанию
    autoCreate = true,
  } = options;

  const db = getDatabase();
  
  // Проверяем, есть ли уже связь
  const existingLink = await db
    .select()
    .from(eventLinks)
    .where(eq(eventLinks.payment_id, paymentId))
    .limit(1);

  if (existingLink.length > 0) {
    return {
      created: false,
      linkId: existingLink[0].id,
      eventId: existingLink[0].event_id || null,
      historyId: existingLink[0].history_id || null,
      linkType: existingLink[0].link_type || 'webhook_to_payment',
      confidence: (existingLink[0].confidence as 'high' | 'medium' | 'low') || 'low',
    };
  }

  const companyId = await getCompanyId(branch);
  if (!companyId) {
    console.warn(`Unknown branch: ${branch}`);
    return {
      created: false,
      linkId: null,
      eventId: null,
      historyId: null,
      linkType: 'webhook_to_payment',
      confidence: 'low',
    };
  }

  // 1. Поиск события в events по payment_id и времени
  // Используем прямой SQL запрос, так как events не в Drizzle схеме
  const eventQuery = sql`
    SELECT id, ts, rentprog_id, payload
    FROM events
    WHERE 
      entity_type = 'payment'
      AND rentprog_id = ${String(rpPaymentId)}
      AND company_id = ${companyId}
      AND ABS(EXTRACT(EPOCH FROM (ts - ${paymentDate}::timestamptz))) < ${timeWindowSeconds}
    ORDER BY ABS(EXTRACT(EPOCH FROM (ts - ${paymentDate}::timestamptz)))
    LIMIT 1
  `;

  const events = await db.execute(eventQuery) as any[];
  const event = events[0] as { id: number; ts: Date; rentprog_id: string; payload: any } | undefined;

  // 2. Поиск записи в history по operation_type и entity_id
  const historyQuery = sql`
    SELECT id, operation_type, created_at, raw_data
    FROM history
    WHERE 
      branch = ${branch}
      AND entity_type = 'payment'
      AND entity_id = ${String(rpPaymentId)}
      AND ABS(EXTRACT(EPOCH FROM (created_at - ${paymentDate}::timestamptz))) < ${timeWindowSeconds}
    ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - ${paymentDate}::timestamptz)))
    LIMIT 1
  `;

  const historyRecords = await db.execute(historyQuery) as any[];
  const history = historyRecords[0] as { id: number; operation_type: string; created_at: Date; raw_data: any } | undefined;

  // 3. Вычисляем метрики для определения уверенности
  const hasEvent = !!event;
  const hasHistory = !!history;
  const eventTimeDiff = event ? Math.abs(event.ts.getTime() - paymentDate.getTime()) / 1000 : null;
  const historyTimeDiff = history ? Math.abs(history.created_at.getTime() - paymentDate.getTime()) / 1000 : null;
  const minTimeDiff = eventTimeDiff !== null && historyTimeDiff !== null 
    ? Math.min(eventTimeDiff, historyTimeDiff)
    : eventTimeDiff || historyTimeDiff;
  const idMatch = hasEvent || hasHistory; // Если нашли по ID - это точное совпадение

  const confidence = calculateConfidence(hasEvent, hasHistory, minTimeDiff, idMatch);
  const linkType = determineLinkType(hasEvent, hasHistory);

  // 4. Находим entity_id через external_refs
  let entityId: string | null = null;
  const externalRef = await db
    .select({ entity_id: externalRefs.entity_id })
    .from(externalRefs)
    .where(
      and(
        eq(externalRefs.system, 'rentprog'),
        eq(externalRefs.entity_type, 'payment'),
        eq(externalRefs.external_id, String(rpPaymentId)),
        eq(externalRefs.branch_code, branch)
      )
    )
    .limit(1);

  if (externalRef.length > 0) {
    entityId = externalRef[0].entity_id;
  }

  // 5. Создаем связь
  if (!autoCreate && !hasEvent && !hasHistory) {
    return {
      created: false,
      linkId: null,
      eventId: null,
      historyId: null,
      linkType,
      confidence,
    };
  }

  const [newLink] = await db
    .insert(eventLinks)
    .values({
      entity_type: 'payment',
      entity_id: entityId,
      event_id: event?.id || null,
      payment_id: paymentId,
      history_id: history?.id || null,
      rp_entity_id: String(rpPaymentId),
      rp_company_id: companyId,
      link_type: linkType,
      confidence,
      matched_at: new Date(),
      matched_by: 'auto',
      metadata: {
        payment_date: paymentDate.toISOString(),
        event_time: event?.ts?.toISOString() || null,
        history_time: history?.created_at?.toISOString() || null,
        time_diff_seconds: minTimeDiff,
        time_window_seconds: timeWindowSeconds,
      },
    })
    .returning({ id: eventLinks.id });

  return {
    created: true,
    linkId: newLink.id,
    eventId: event?.id || null,
    historyId: history?.id || null,
    linkType,
    confidence,
  };
}

/**
 * Связать событие (event) с платежами и историей
 */
export async function linkEvent(
  eventId: number,
  branch: BranchName,
  rpEntityId: string,
  entityType: 'payment' | 'car' | 'booking' | 'client',
  eventTime: Date,
  options: LinkOptions = {}
): Promise<LinkResult> {
  const {
    timeWindowSeconds = 300,
    autoCreate = true,
  } = options;

  const db = getDatabase();
  
  // Проверяем, есть ли уже связь
  const existingLink = await db
    .select()
    .from(eventLinks)
    .where(eq(eventLinks.event_id, eventId))
    .limit(1);

  if (existingLink.length > 0) {
    return {
      created: false,
      linkId: existingLink[0].id,
      eventId: existingLink[0].event_id || null,
      historyId: existingLink[0].history_id || null,
      linkType: existingLink[0].link_type || 'webhook_to_payment',
      confidence: (existingLink[0].confidence as 'high' | 'medium' | 'low') || 'low',
    };
  }

  // Поиск платежа (если entity_type = 'payment')
  let paymentId: string | null = null;
  if (entityType === 'payment') {
    const payment = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.branch, branch),
          eq(payments.payment_id, Number(rpEntityId))
        )
      )
      .limit(1);

    if (payment.length > 0) {
      paymentId = payment[0].id;
    }
  }

  // Поиск в history
  const historyQuery = sql`
    SELECT id, created_at
    FROM history
    WHERE 
      branch = ${branch}
      AND entity_type = ${entityType}
      AND entity_id = ${rpEntityId}
      AND ABS(EXTRACT(EPOCH FROM (created_at - ${eventTime}::timestamptz))) < ${timeWindowSeconds}
    ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - ${eventTime}::timestamptz)))
    LIMIT 1
  `;

  const historyRecords = await db.execute(historyQuery) as any[];
  const history = historyRecords[0] as { id: number; created_at: Date } | undefined;

  const hasPayment = !!paymentId;
  const hasHistory = !!history;
  const historyTimeDiff = history ? Math.abs(history.created_at.getTime() - eventTime.getTime()) / 1000 : null;
  const confidence = calculateConfidence(hasPayment, hasHistory, historyTimeDiff, true);
  const linkType = determineLinkType(hasPayment, hasHistory);

  if (!autoCreate && !hasPayment && !hasHistory) {
    return {
      created: false,
      linkId: null,
      eventId: null,
      historyId: null,
      linkType,
      confidence,
    };
  }

  const companyId = await getCompanyId(branch);
  
  // Находим entity_id через external_refs
  let entityId: string | null = null;
  const externalRef = await db
    .select({ entity_id: externalRefs.entity_id })
    .from(externalRefs)
    .where(
      and(
        eq(externalRefs.system, 'rentprog'),
        eq(externalRefs.entity_type, entityType),
        eq(externalRefs.external_id, rpEntityId),
        eq(externalRefs.branch_code, branch)
      )
    )
    .limit(1);

  if (externalRef.length > 0) {
    entityId = externalRef[0].entity_id;
  }

  const [newLink] = await db
    .insert(eventLinks)
    .values({
      entity_type: entityType,
      entity_id: entityId,
      event_id: eventId,
      payment_id: paymentId,
      history_id: history?.id || null,
      rp_entity_id: rpEntityId,
      rp_company_id: companyId,
      link_type: linkType,
      confidence,
      matched_at: new Date(),
      matched_by: 'auto',
      metadata: {
        event_time: eventTime.toISOString(),
        history_time: history?.created_at?.toISOString() || null,
        time_diff_seconds: historyTimeDiff,
        time_window_seconds: timeWindowSeconds,
      },
    })
    .returning({ id: eventLinks.id });

  return {
    created: true,
    linkId: newLink.id,
    eventId,
    historyId: history?.id || null,
    linkType,
    confidence,
  };
}

/**
 * Получить все связи для сущности
 */
export async function getLinksForEntity(
  entityType: string,
  entityId: string
): Promise<EventLink[]> {
  const db = getDatabase();
  return await db
    .select()
    .from(eventLinks)
    .where(
      and(
        eq(eventLinks.entity_type, entityType),
        eq(eventLinks.entity_id, entityId)
      )
    );
}

/**
 * Получить все связи для платежа
 */
export async function getLinksForPayment(paymentId: string): Promise<EventLink[]> {
  const db = getDatabase();
  return await db
    .select()
    .from(eventLinks)
    .where(eq(eventLinks.payment_id, paymentId));
}

/**
 * Получить статистику связей
 */
export async function getLinksStats() {
  const db = getDatabase();
  const stats = await db.execute(sql`
    SELECT 
      entity_type,
      link_type,
      confidence,
      matched_by,
      COUNT(*) as total_links,
      COUNT(DISTINCT entity_id) as unique_entities
    FROM event_links
    GROUP BY entity_type, link_type, confidence, matched_by
    ORDER BY total_links DESC
  `);

  return (stats as any[]) || [];
}

