/**
 * Бэкфилл для добавления старых платежей в entity_timeline
 * 
 * Записывает в timeline все существующие платежи из таблицы payments
 */

import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Добавить платеж в timeline
 */
async function addPaymentToTimeline(payment) {
  // Определить operation - в RentProg это boolean, используем created_at/updated_at
  let operation = 'create'; // По умолчанию для всех платежей

  // Получить branch_code
  let branchCode = null;
  if (payment.branch_id) {
    const [branch] = await sql`
      SELECT code FROM branches WHERE id = ${payment.branch_id} LIMIT 1
    `;
    branchCode = branch?.code || null;
  }

  // Получить имя сотрудника
  let userName = null;
  if (payment.employee_id) {
    const [employee] = await sql`
      SELECT name FROM employees WHERE id = ${payment.employee_id} LIMIT 1
    `;
    userName = employee?.name || null;
  }

  // Найти связанные сущности
  const relatedEntities = [];
  
  if (payment.booking_id) {
    relatedEntities.push({ type: 'booking', id: payment.booking_id });
  }
  
  if (payment.raw_data?.car_id) {
    // Найти car_id через external_refs
    const [carRef] = await sql`
      SELECT entity_id 
      FROM external_refs 
      WHERE entity_type = 'car' 
        AND system = 'rentprog' 
        AND external_id = ${String(payment.raw_data.car_id)}
      LIMIT 1
    `;
    if (carRef) {
      relatedEntities.push({ type: 'car', id: carRef.entity_id });
    }
  }
  
  if (payment.raw_data?.client_id) {
    // Найти client_id через external_refs
    const [clientRef] = await sql`
      SELECT entity_id 
      FROM external_refs 
      WHERE entity_type = 'client' 
        AND system = 'rentprog' 
        AND external_id = ${String(payment.raw_data.client_id)}
      LIMIT 1
    `;
    if (clientRef) {
      relatedEntities.push({ type: 'client', id: clientRef.entity_id });
    }
  }

  // Сформировать summary
  const amount = payment.amount || 0;
  const currency = payment.currency || 'GEL';
  const paymentType = payment.payment_type || 'unknown';
  const summary = `Платеж ${amount} ${currency} (${paymentType})`;

  // Сформировать details
  const details = {
    amount: String(amount),
    currency,
    payment_type: paymentType,
    payment_method: payment.payment_method || null,
    description: payment.description || null,
    rentprog_count_id: payment.raw_data?.id || null,  // используем "id" из raw_data
  };

  // Вставить в timeline
  try {
    // Определить timestamp (payment_date или created_at)
    const timestamp = payment.payment_date || payment.created_at;
    if (!timestamp) {
      console.warn(`  ⚠️  Пропущен платеж ${payment.id}: нет timestamp`);
      return false;
    }

    await sql`
      INSERT INTO entity_timeline (
        ts,
        entity_type,
        entity_id,
        source_type,
        source_id,
        event_type,
        operation,
        summary,
        details,
        branch_code,
        user_name,
        confidence,
        related_entities
      ) VALUES (
        ${timestamp},
        'payment',
        ${payment.id},
        'rentprog_payment',
        ${String(payment.raw_data?.id || payment.id)},
        'payment.recorded',
        ${operation},
        ${summary},
        ${JSON.stringify(details)},
        ${branchCode || null},
        ${userName || null},
        'high',
        ${relatedEntities.length > 0 ? JSON.stringify(relatedEntities) : null}
      )
      ON CONFLICT DO NOTHING
    `;
    return true;
  } catch (err) {
    console.error(`  ✗ Ошибка добавления в timeline:`, err.message);
    return false;
  }
}

/**
 * Главная функция
 */
async function main() {
  console.log('📝 Entity Timeline Backfill - Добавление старых платежей\n');

  try {
    // 1. Проверить сколько платежей уже в timeline
    const [existing] = await sql`
      SELECT COUNT(*) as count
      FROM entity_timeline
      WHERE entity_type = 'payment'
    `;

    console.log(`Платежей уже в timeline: ${existing.count}`);

    // 2. Получить все платежи из payments
    const allPayments = await sql`
      SELECT 
        p.id,
        p.branch_id,
        p.booking_id,
        p.employee_id,
        p.payment_date,
        p.payment_type,
        p.payment_method,
        p.amount,
        p.currency,
        p.description,
        p.raw_data,
        p.created_at
      FROM payments p
      ORDER BY p.payment_date DESC
    `;

    console.log(`Всего платежей в БД: ${allPayments.length}`);

    // 3. Найти платежи, которых нет в timeline
    const paymentsNotInTimeline = await sql`
      SELECT 
        p.id,
        p.branch_id,
        p.booking_id,
        p.employee_id,
        p.payment_date,
        p.payment_type,
        p.payment_method,
        p.amount,
        p.currency,
        p.description,
        p.raw_data,
        p.created_at
      FROM payments p
      WHERE NOT EXISTS (
        SELECT 1 
        FROM entity_timeline et 
        WHERE et.entity_type = 'payment' 
          AND et.entity_id = p.id
      )
      ORDER BY p.payment_date DESC
    `;

    console.log(`Платежей для добавления: ${paymentsNotInTimeline.length}\n`);

    if (paymentsNotInTimeline.length === 0) {
      console.log('✅ Все платежи уже в timeline!');
      return;
    }

    // 4. Добавить в timeline
    let processed = 0;
    let added = 0;
    let errors = 0;

    console.log('🔄 Начинаем добавление...\n');

    for (const payment of paymentsNotInTimeline) {
      try {
        const success = await addPaymentToTimeline(payment);
        
        processed++;
        if (success) {
          added++;
          const amount = payment.amount;
          const currency = payment.currency || 'GEL';
          console.log(`  ✓ ${payment.id} - ${amount} ${currency}`);
        } else {
          errors++;
        }

        // Пауза каждые 20 записей
        if (processed % 20 === 0) {
          console.log(`\n--- Обработано: ${processed}/${paymentsNotInTimeline.length} ---\n`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (err) {
        errors++;
        console.error(`  ✗ Ошибка обработки платежа ${payment.id}:`, err.message);
      }
    }

    // 5. Итоговая статистика
    console.log('\n' + '='.repeat(60));
    console.log('📈 ИТОГИ БЭКФИЛЛА');
    console.log('='.repeat(60));
    console.log(`Обработано платежей: ${processed}`);
    console.log(`Добавлено в timeline: ${added}`);
    console.log(`Ошибок: ${errors}`);

    // 6. Финальная проверка
    const [final] = await sql`
      SELECT COUNT(*) as count
      FROM entity_timeline
      WHERE entity_type = 'payment'
    `;

    console.log(`\nПлатежей в timeline: ${final.count} (было ${existing.count})`);
    console.log(`Добавлено: ${final.count - existing.count}`);

    // 7. Статистика по источникам в timeline
    const sourceStats = await sql`
      SELECT 
        source_type,
        COUNT(*) as count
      FROM entity_timeline
      GROUP BY source_type
      ORDER BY count DESC
    `;

    console.log('\n📊 События в timeline по источникам:');
    for (const stat of sourceStats) {
      console.log(`  ${stat.source_type}: ${stat.count}`);
    }

    // 8. Статистика по типам сущностей
    const entityStats = await sql`
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM entity_timeline
      GROUP BY entity_type
      ORDER BY count DESC
    `;

    console.log('\n📊 События в timeline по сущностям:');
    for (const stat of entityStats) {
      console.log(`  ${stat.entity_type}: ${stat.count}`);
    }

    console.log('\n🎉 Бэкфилл завершен успешно!');

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

