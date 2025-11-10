/**
 * Функции для работы с платежами в БД
 */

import { randomUUID } from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { getDatabase } from './index.js';
import { payments, branches, externalRefs, type PaymentInsert } from './schema.js';

/**
 * Извлечь все поля из raw_data RentProg для разноски по колонкам
 */
function extractPaymentFields(rawData: any) {
  return {
    // RentProg IDs
    rp_payment_id: rawData.id || null,
    rp_car_id: rawData.car_id || null,
    rp_user_id: rawData.user_id || null,
    rp_client_id: rawData.client_id || null,
    rp_company_id: rawData.company_id || null,
    rp_cashbox_id: rawData.company_cashbox_id || null,
    rp_category_id: rawData.counts_category_id || null,
    rp_subcategory_id: rawData.counts_subcategory_id || null,
    
    // Коды
    car_code: rawData.car_code || null,
    payment_subgroup: rawData.subgroup || null,
    
    // Финансовые
    exchange_rate: rawData.rate ? String(rawData.rate) : null,
    rated_amount: rawData.rated_sum ? String(rawData.rated_sum) : null,
    last_balance: rawData.last_balance !== undefined ? String(rawData.last_balance) : null,
    
    // Статусы
    has_check: rawData.check || false,
    is_completed: rawData.completed || false,
    is_operation: rawData.operation || false,
    is_tinkoff_paid: rawData.tinkoff_paid || false,
    is_client_balance: rawData.client_balance || false,
    
    // Связи
    debt_id: rawData.debt_id || null,
    agent_id: rawData.agent_id || null,
    investor_id: rawData.investor_id || null,
    contractor_id: rawData.contractor_id || null,
    
    // Даты
    completed_at: rawData.completed_at ? new Date(rawData.completed_at) : null,
    completed_by: rawData.completed_by || null,
  };
}

/**
 * Сохранить платеж из RentProg в БД
 */
export async function savePaymentFromRentProg(
  payment: {
    branch: string;
    paymentDate: string;
    employeeName: string;
    paymentType: string;
    paymentMethod: string;
    amount: number;
    currency: string;
    comment: string;
    rawData: any;
  }
): Promise<{ paymentId: string; created: boolean }> {
  const db = getDatabase();
  
  try {
    // 1. Найти branch_id по коду филиала
    const [branchRow] = await db
      .select()
      .from(branches)
      .where(eq(branches.code, payment.branch))
      .limit(1);
    
    if (!branchRow) {
      throw new Error(`Branch not found: ${payment.branch}`);
    }
    
    // 2. Найти booking_id если есть booking_id в rawData
    let bookingId: string | null = null;
    if (payment.rawData.booking_id) {
      const [bookingRef] = await db
        .select()
        .from(externalRefs)
        .where(
          and(
            eq(externalRefs.entity_type, 'booking'),
            eq(externalRefs.system, 'rentprog'),
            eq(externalRefs.external_id, String(payment.rawData.booking_id))
          )
        )
        .limit(1);
      
      if (bookingRef) {
        bookingId = bookingRef.entity_id;
      }
    }
    
    // 3. Проверить существует ли уже этот платеж (по external_id в external_refs)
    const rentprogCountId = String(payment.rawData.id);
    const [existingRef] = await db
      .select()
      .from(externalRefs)
      .where(
        and(
          eq(externalRefs.entity_type, 'payment'),
          eq(externalRefs.system, 'rentprog'),
          eq(externalRefs.external_id, rentprogCountId)
        )
      )
      .limit(1);
    
    if (existingRef) {
      // Платеж уже существует, обновляем
      const existingPaymentId = existingRef.entity_id;
      await db
        .update(payments)
        .set({
          payment_date: new Date(payment.paymentDate),
          payment_type: payment.paymentType,
          payment_method: payment.paymentMethod,
          amount: String(payment.amount),
          currency: payment.currency,
          description: payment.comment,
          raw_data: payment.rawData,
          updated_at: new Date(),
        })
        .where(eq(payments.id, existingPaymentId));
      
      // Проверить и обновить связывание (если еще не связано)
      try {
        const { linkPayment } = await import('./eventLinks');
        const { getLinksForPayment } = await import('./eventLinks');
        const existingLinks = await getLinksForPayment(existingPaymentId);
        
        // Если нет связей, попробуем связать
        if (existingLinks.length === 0) {
          await linkPayment(
            existingPaymentId,
            payment.branch as any,
            Number(rentprogCountId),
            new Date(payment.paymentDate),
            { timeWindowSeconds: 300, autoCreate: true }
          );
        }
      } catch (linkError) {
        // Не критично
        console.warn('Failed to link existing payment:', linkError);
      }
      
      // Проверить и добавить в timeline (если еще нет)
      try {
        const { getDatabase } = await import('./index');
        const { sql } = await import('drizzle-orm');
        const db = getDatabase();
        if (db) {
          const existingTimeline = await db.execute(sql`
            SELECT id FROM entity_timeline
            WHERE entity_type = 'payment'
              AND entity_id = ${existingPaymentId}
            LIMIT 1
          `);
          
          if (!existingTimeline || (existingTimeline as any[]).length === 0) {
            const { addPaymentToTimeline } = await import('./entityTimeline');
            
            // Найти client_id если есть
            let clientId: string | undefined;
            if (payment.rawData.client_id) {
              const [clientRef] = await db
                .select()
                .from(externalRefs)
                .where(
                  and(
                    eq(externalRefs.entity_type, 'client'),
                    eq(externalRefs.system, 'rentprog'),
                    eq(externalRefs.external_id, String(payment.rawData.client_id))
                  )
                )
                .limit(1);
              if (clientRef) {
                clientId = clientRef.entity_id;
              }
            }
            
            await addPaymentToTimeline(
              existingPaymentId,
              payment.branch as any,
              {
                amount: String(payment.amount),
                currency: payment.currency,
                description: payment.comment,
                bookingId: bookingId || undefined,
                clientId,
                employeeId: undefined,
              }
            );
          }
        }
      } catch (timelineError) {
        // Не критично
        console.warn('Failed to add existing payment to timeline:', timelineError);
      }
      
      return { paymentId: existingPaymentId, created: false };
    }
    
    // 4. Создать новый платеж
    const [newPayment] = await db
      .insert(payments)
      .values({
        branch_id: branchRow.id,
        booking_id: bookingId,
        employee_id: null, // TODO: связать с employee по user_id
        payment_date: new Date(payment.paymentDate),
        payment_type: payment.paymentType,
        payment_method: payment.paymentMethod,
        amount: String(payment.amount),
        currency: payment.currency,
        description: payment.comment,
        raw_data: payment.rawData,
      })
      .returning({ id: payments.id });
    
    // 5. Создать external_ref для связи с RentProg
    await db.insert(externalRefs).values({
      entity_type: 'payment',
      entity_id: newPayment.id,
      system: 'rentprog',
      external_id: rentprogCountId,
      branch_code: payment.branch,
      data: payment.rawData,
    });
    
    // 6. Автоматически связать с events и history
    try {
      const { linkPayment } = await import('./eventLinks');
      await linkPayment(
        newPayment.id,
        payment.branch as any,
        Number(rentprogCountId),
        new Date(payment.paymentDate),
        { timeWindowSeconds: 300, autoCreate: true }
      );
    } catch (linkError) {
      // Не критично, если связывание не удалось - логируем и продолжаем
      console.warn('Failed to link payment:', linkError);
    }
    
    // 7. Записать в timeline
    try {
      const { addPaymentToTimeline } = await import('./entityTimeline');
      
      // Найти client_id если есть
      let clientId: string | undefined;
      if (payment.rawData.client_id) {
        const [clientRef] = await db
          .select()
          .from(externalRefs)
          .where(
            and(
              eq(externalRefs.entity_type, 'client'),
              eq(externalRefs.system, 'rentprog'),
              eq(externalRefs.external_id, String(payment.rawData.client_id))
            )
          )
          .limit(1);
        if (clientRef) {
          clientId = clientRef.entity_id;
        }
      }
      
      await addPaymentToTimeline(
        newPayment.id,
        payment.branch as any,
        {
          amount: String(payment.amount),
          currency: payment.currency,
          description: payment.comment,
          bookingId: bookingId || undefined,
          clientId,
          employeeId: undefined, // TODO: связать с employee
        }
      );
    } catch (timelineError) {
      // Не критично, если запись в timeline не удалась - логируем и продолжаем
      console.warn('Failed to add payment to timeline:', timelineError);
    }
    
    return { paymentId: newPayment.id, created: true };
    
  } catch (error) {
    console.error('Error saving payment:', error);
    throw error;
  }
}

/**
 * Массовое сохранение платежей
 */
export async function savePaymentsBatch(
  paymentsData: Array<{
    branch: string;
    paymentDate: string;
    employeeName: string;
    paymentType: string;
    paymentMethod: string;
    amount: number;
    currency: string;
    comment: string;
    rawData: any;
  }>
): Promise<{ saved: number; created: number; updated: number; errors: number }> {
  let saved = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const payment of paymentsData) {
    try {
      const result = await savePaymentFromRentProg(payment);
      saved++;
      if (result.created) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`Error saving payment ${payment.rawData.id}:`, error);
      errors++;
    }
  }
  
  return { saved, created, updated, errors };
}

/**
 * ОПТИМИЗИРОВАННАЯ массовая вставка платежей с batch insert и кэшированием
 * Скорость: ~100-200 платежей/сек вместо 1-2/сек
 */
export async function savePaymentsBatchOptimized(
  paymentsData: Array<{
    branch: string;
    paymentDate: string;
    employeeName: string;
    paymentType: string;
    paymentMethod: string;
    amount: number;
    currency: string;
    comment: string;
    rawData: any;
  }>
): Promise<{ saved: number; created: number; updated: number; errors: number; duration: number }> {
  const db = getDatabase();
  const startTime = Date.now();
  
  try {
    // 1. Кэшируем branch_id (один запрос вместо N)
    const branchesData = await db.select().from(branches);
    const branchesMap = new Map<string, string>();
    branchesData.forEach(b => branchesMap.set(b.code, b.id));
    
    // 2. Предзагружаем все external_refs для дедупликации
    const rentprogIds = paymentsData.map(p => String(p.rawData.id)).filter(Boolean);
    
    let existingRefsMap = new Map<string, string>();
    if (rentprogIds.length > 0) {
      const existingRefs = await db
        .select()
        .from(externalRefs)
        .where(
          and(
            eq(externalRefs.entity_type, 'payment'),
            eq(externalRefs.system, 'rentprog'),
            inArray(externalRefs.external_id, rentprogIds)
          )
        );
      
      existingRefsMap = new Map(
        existingRefs.map(ref => [ref.external_id, ref.entity_id])
      );
    }
    
    // 3. Предзагружаем маппинг booking_id (RentProg -> наш UUID)
    const bookingIds = [...new Set(paymentsData.map(p => p.rawData.booking_id).filter(Boolean))].map(String);
    const bookingRefsMap = new Map<string, string>();
    
    if (bookingIds.length > 0) {
      const bookingRefs = await db
        .select()
        .from(externalRefs)
        .where(
          and(
            eq(externalRefs.entity_type, 'booking'),
            eq(externalRefs.system, 'rentprog'),
            inArray(externalRefs.external_id, bookingIds)
          )
        );
      
      bookingRefs.forEach(ref => bookingRefsMap.set(ref.external_id, ref.entity_id));
      console.log(`✅ Loaded ${bookingRefs.length} booking mappings`);
    }
    
    // 4. Предзагружаем маппинг employee_id (RentProg user_id -> наш UUID)
    const userIds = [...new Set(paymentsData.map(p => p.rawData.user_id).filter(Boolean))].map(String);
    const employeeRefsMap = new Map<string, string>();
    
    if (userIds.length > 0) {
      const employeeRefs = await db
        .select()
        .from(externalRefs)
        .where(
          and(
            eq(externalRefs.entity_type, 'employee'),
            eq(externalRefs.system, 'rentprog'),
            inArray(externalRefs.external_id, userIds)
          )
        );
      
      employeeRefs.forEach(ref => employeeRefsMap.set(ref.external_id, ref.entity_id));
      console.log(`✅ Loaded ${employeeRefs.length} employee mappings`);
    }
    
    // 5. Готовим данные для batch insert
    const paymentsToInsert: any[] = [];
    const externalRefsToInsert: any[] = [];
    
    for (const payment of paymentsData) {
      const rentprogId = String(payment.rawData.id);
      
      // Пропускаем если уже есть
      if (existingRefsMap.has(rentprogId)) {
        continue;
      }
      
      const branchId = branchesMap.get(payment.branch);
      if (!branchId) {
        console.warn(`Branch not found: ${payment.branch}`);
        continue;
      }
      
      // Извлекаем поля из raw_data
      const extractedFields = extractPaymentFields(payment.rawData);
      
      // Находим booking_id и employee_id через маппинги
      const bookingId = payment.rawData.booking_id 
        ? bookingRefsMap.get(String(payment.rawData.booking_id)) || null
        : null;
      
      const employeeId = payment.rawData.user_id
        ? employeeRefsMap.get(String(payment.rawData.user_id)) || null
        : null;
      
      const paymentId = randomUUID();
      
      paymentsToInsert.push({
        id: paymentId,
        branch_id: branchId,
        booking_id: bookingId,
        employee_id: employeeId,
        payment_date: new Date(payment.paymentDate),
        payment_type: payment.paymentType,
        payment_method: payment.paymentMethod,
        amount: String(payment.amount),
        currency: payment.currency,
        description: payment.comment,
        ...extractedFields,
        raw_data: null, // ОЧИЩАЕМ после разноски!
      });
      
      externalRefsToInsert.push({
        entity_type: 'payment',
        entity_id: paymentId,
        system: 'rentprog',
        external_id: rentprogId,
        branch_code: payment.branch,
        data: null, // Можем сохранить оригинал сюда при необходимости
      });
    }
    
    // 6. Batch insert (вставляем порциями по 100 для безопасности)
    let created = 0;
    const chunkSize = 100;
    
    for (let i = 0; i < paymentsToInsert.length; i += chunkSize) {
      const paymentsChunk = paymentsToInsert.slice(i, i + chunkSize);
      const refsChunk = externalRefsToInsert.slice(i, i + chunkSize);
      
      if (paymentsChunk.length > 0) {
        await db.insert(payments).values(paymentsChunk);
        await db.insert(externalRefs).values(refsChunk);
        created += paymentsChunk.length;
        
        console.log(`✅ Inserted batch ${Math.floor(i / chunkSize) + 1}: ${paymentsChunk.length} payments`);
      }
    }
    
    const duration = Date.now() - startTime;
    const speed = created > 0 ? (created / (duration / 1000)).toFixed(2) : '0';
    
    // Статистика по связям
    const linkedBookings = paymentsToInsert.filter(p => p.booking_id !== null).length;
    const linkedEmployees = paymentsToInsert.filter(p => p.employee_id !== null).length;
    
    console.log(`🚀 Total: ${created} payments in ${(duration / 1000).toFixed(2)}s (${speed} payments/sec)`);
    console.log(`🔗 Linked: ${linkedBookings} bookings, ${linkedEmployees} employees`);
    
    return {
      saved: created,
      created,
      updated: 0,
      errors: 0,
      duration,
    };
    
  } catch (error) {
    console.error('❌ Error in savePaymentsBatchOptimized:', error);
    throw error;
  }
}

/**
 * Получить статистику платежей по филиалу
 */
export async function getPaymentStats(branchCode: string, dateFrom?: Date, dateTo?: Date) {
  const db = getDatabase();
  
  // TODO: Реализовать агрегацию платежей
  // Пока просто возвращаем заглушку
  return {
    totalPayments: 0,
    totalAmount: 0,
    byMethod: {},
    byType: {},
  };
}

