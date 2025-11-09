/**
 * Умный бэкфилл event_links - связывание events с payments через bookings
 * 
 * События в events - это изменения booking/car/client
 * Платежи в payments связаны с bookings
 * Связываем через booking_id
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Маппинг company_id -> branch
const COMPANY_TO_BRANCH = {
  9247: 'tbilisi',
  9248: 'batumi',
  9506: 'kutaisi',
  11163: 'service-center',
  11157: 'tbilisi',     // Дополнительные ID из реальных данных
  11158: 'service-center',
  11162: 'kutaisi',
};

/**
 * Связать event о booking с платежами этой брони
 */
async function linkBookingEventToPayments(eventId, bookingRpId, companyId, eventTime) {
  const branch = COMPANY_TO_BRANCH[companyId] || 'tbilisi';
  
  // 1. Найти booking в нашей БД через external_refs
  const [bookingRef] = await sql`
    SELECT entity_id 
    FROM external_refs
    WHERE system = 'rentprog'
      AND entity_type = 'booking'
      AND external_id = ${String(bookingRpId)}
      AND branch_code = ${branch}
    LIMIT 1
  `;
  
  if (!bookingRef) {
    return { linked: 0, reason: 'booking not found in external_refs' };
  }
  
  const bookingId = bookingRef.entity_id;
  
  // 2. Найти платежи этой брони
  const payments = await sql`
    SELECT id, payment_id, payment_date, amount, currency
    FROM payments
    WHERE booking_id = ${bookingId}
    ORDER BY payment_date
  `;
  
  if (payments.length === 0) {
    return { linked: 0, reason: 'no payments for this booking' };
  }
  
  let linksCreated = 0;
  
  // 3. Создать связи для каждого платежа
  for (const payment of payments) {
    // Проверяем, нет ли уже связи
    const [existing] = await sql`
      SELECT id FROM event_links
      WHERE event_id = ${eventId} AND payment_id = ${payment.id}
      LIMIT 1
    `;
    
    if (existing) continue;
    
    // Вычисляем разницу во времени
    const timeDiff = Math.abs(new Date(eventTime).getTime() - new Date(payment.payment_date).getTime()) / 1000;
    
    // Определяем confidence
    let confidence = 'low';
    if (timeDiff < 300) confidence = 'high';      // < 5 минут
    else if (timeDiff < 3600) confidence = 'medium';  // < 1 час
    
    try {
      await sql`
        INSERT INTO event_links (
          entity_type,
          entity_id,
          event_id,
          payment_id,
          history_id,
          rp_entity_id,
          rp_company_id,
          link_type,
          confidence,
          matched_at,
          matched_by,
          metadata
        ) VALUES (
          'booking',
          ${bookingId},
          ${eventId},
          ${payment.id},
          NULL,
          ${String(bookingRpId)},
          ${companyId},
          'webhook_to_payment',
          ${confidence},
          NOW(),
          'backfill',
          ${JSON.stringify({
            payment_amount: payment.amount,
            payment_currency: payment.currency,
            payment_date: payment.payment_date,
            event_time: eventTime,
            time_diff_seconds: timeDiff,
            link_reason: 'same_booking'
          })}
        )
        ON CONFLICT DO NOTHING
      `;
      linksCreated++;
    } catch (err) {
      console.warn(`    ✗ Ошибка создания связи: ${err.message}`);
    }
  }
  
  return { linked: linksCreated, payments: payments.length };
}

/**
 * Связать event с history по времени и entity_id
 */
async function linkEventToHistory(eventId, entityType, rentprogId, companyId, eventTime) {
  const branch = COMPANY_TO_BRANCH[companyId] || 'tbilisi';
  
  // Ищем history записи в окне ±15 минут
  const historyRecords = await sql`
    SELECT id, ts, operation_id, raw_data
    FROM history
    WHERE branch = ${branch}
      AND ABS(EXTRACT(EPOCH FROM (ts - ${eventTime}::timestamptz))) < 900
    ORDER BY ABS(EXTRACT(EPOCH FROM (ts - ${eventTime}::timestamptz)))
    LIMIT 3
  `;
  
  if (historyRecords.length === 0) {
    return { linked: 0, reason: 'no history records in time window' };
  }
  
  let linksCreated = 0;
  
  for (const history of historyRecords) {
    // Проверяем, нет ли уже связи
    const [existing] = await sql`
      SELECT id FROM event_links
      WHERE event_id = ${eventId} AND history_id = ${history.id}
      LIMIT 1
    `;
    
    if (existing) continue;
    
    const timeDiff = Math.abs(new Date(eventTime).getTime() - new Date(history.ts).getTime()) / 1000;
    
    let confidence = 'low';
    if (timeDiff < 60) confidence = 'high';
    else if (timeDiff < 300) confidence = 'medium';
    
    try {
      await sql`
        INSERT INTO event_links (
          entity_type,
          entity_id,
          event_id,
          payment_id,
          history_id,
          rp_entity_id,
          rp_company_id,
          link_type,
          confidence,
          matched_at,
          matched_by,
          metadata
        ) VALUES (
          ${entityType},
          NULL,
          ${eventId},
          NULL,
          ${history.id},
          ${String(rentprogId)},
          ${companyId},
          'webhook_to_history',
          ${confidence},
          NOW(),
          'backfill',
          ${JSON.stringify({
            event_time: eventTime,
            history_time: history.ts,
            time_diff_seconds: timeDiff,
            link_reason: 'time_proximity'
          })}
        )
        ON CONFLICT DO NOTHING
      `;
      linksCreated++;
    } catch (err) {
      console.warn(`    ✗ Ошибка создания связи: ${err.message}`);
    }
  }
  
  return { linked: linksCreated, candidates: historyRecords.length };
}

/**
 * Главная функция
 */
async function main() {
  console.log('🔗 Бэкфилл event_links\n');
  console.log('Стратегия:');
  console.log('  1. События о bookings → платежи через booking_id');
  console.log('  2. Все события → history по времени (±15 минут)');
  console.log();

  try {
    let totalLinks = 0;
    let processedEvents = 0;
    
    // Получить все события о bookings
    console.log('📊 Обработка событий о бронированиях:\n');
    const bookingEvents = await sql`
      SELECT id, type, rentprog_id, company_id, ts
      FROM events
      WHERE entity_type = 'booking'
        AND rentprog_id IS NOT NULL
      ORDER BY ts DESC
    `;
    
    console.log(`Найдено ${bookingEvents.length} событий о bookings\n`);
    
    for (const event of bookingEvents) {
      processedEvents++;
      
      if (processedEvents % 10 === 0) {
        console.log(`--- Обработано: ${processedEvents}/${bookingEvents.length} ---\n`);
      }
      
      // Связать с платежами через booking
      const paymentResult = await linkBookingEventToPayments(
        event.id,
        event.rentprog_id,
        event.company_id,
        event.ts
      );
      
      if (paymentResult.linked > 0) {
        console.log(`  ✓ Event ${event.id} (booking ${event.rentprog_id}): ${paymentResult.linked} платежей`);
        totalLinks += paymentResult.linked;
      }
      
      // Связать с history
      const historyResult = await linkEventToHistory(
        event.id,
        'booking',
        event.rentprog_id,
        event.company_id,
        event.ts
      );
      
      if (historyResult.linked > 0) {
        console.log(`  ✓ Event ${event.id}: ${historyResult.linked} history записей`);
        totalLinks += historyResult.linked;
      }
    }
    
    console.log('\n============================================================');
    console.log('📈 ИТОГИ БЭКФИЛЛА');
    console.log('============================================================');
    console.log(`Обработано событий: ${processedEvents}`);
    console.log(`Создано связей: ${totalLinks}`);
    console.log();
    
    // Статистика
    const stats = await sql`
      SELECT 
        link_type,
        confidence,
        COUNT(*) as count
      FROM event_links
      GROUP BY link_type, confidence
      ORDER BY count DESC
    `;
    
    console.log('📊 Связи по типам:');
    stats.forEach(row => {
      console.log(`  ${row.link_type} (${row.confidence}): ${row.count}`);
    });
    console.log();
    
    console.log('🎉 Бэкфилл завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

