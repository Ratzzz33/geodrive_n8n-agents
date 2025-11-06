/**
 * Функции для работы с платежами в БД
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from './index.js';
import { payments, branches, externalRefs, type PaymentInsert } from './schema.js';

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
  const db = getDb();
  
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
        .where(eq(payments.id, existingRef.entity_id));
      
      return { paymentId: existingRef.entity_id, created: false };
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
 * Получить статистику платежей по филиалу
 */
export async function getPaymentStats(branchCode: string, dateFrom?: Date, dateTo?: Date) {
  const db = getDb();
  
  // TODO: Реализовать агрегацию платежей
  // Пока просто возвращаем заглушку
  return {
    totalPayments: 0,
    totalAmount: 0,
    byMethod: {},
    byType: {},
  };
}

