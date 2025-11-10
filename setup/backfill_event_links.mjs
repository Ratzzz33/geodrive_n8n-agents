/**
 * Бэкфилл для связывания старых платежей с events и history
 * 
 * Применяет автоматическое связывание ко всем несвязанным платежам
 */

import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Маппинг company_id на branch name (из RentProg)
 */
// В RentProg company_id (4-5 цифр) означает ID филиала
const COMPANY_ID_TO_BRANCH = {
  9247: 'tbilisi',
  9248: 'kutaisi',
  9506: 'batumi',
  11163: 'service-center'
};

/**
 * Функция связывания платежа (копия логики из src/db/eventLinks.ts)
 */
async function linkPayment(paymentId, branch, rentprogCountId, paymentDate, options = {}) {
  const {
    timeWindowSeconds = 300, // 5 минут
    autoCreate = true
  } = options;

  console.log(`  Связываем платеж ${paymentId} (branch: ${branch}, rp_id: ${rentprogCountId}, date: ${paymentDate})`);

  const timeFrom = new Date(new Date(paymentDate).getTime() - timeWindowSeconds * 1000);
  const timeTo = new Date(new Date(paymentDate).getTime() + timeWindowSeconds * 1000);

  // Получить branch UUID и company_id
  const [branchInfo] = await sql`
    SELECT b.id, er.external_id::integer as company_id
    FROM branches b
    LEFT JOIN external_refs er ON er.entity_id = b.id 
      AND er.entity_type = 'branch' 
      AND er.system = 'rentprog'
    WHERE b.code = ${branch}
    LIMIT 1
  `;

  if (!branchInfo) {
    console.warn(`    ⚠️  Филиал ${branch} не найден`);
    return { eventsFound: 0, historyFound: 0, linksCreated: 0 };
  }

  const branchId = branchInfo.id;
  const companyId = branchInfo.company_id;

  // 1. Найти соответствующие события в events
  const matchingEvents = await sql`
    SELECT e.id, e.company_id, e.ts, e.type, e.ext_id
    FROM events e
    WHERE e.company_id = ${companyId}
    AND e.ts BETWEEN ${timeFrom.toISOString()} AND ${timeTo.toISOString()}
    AND (
      e.ext_id = ${String(rentprogCountId)}
      OR e.rentprog_id = ${String(rentprogCountId)}
    )
    ORDER BY ABS(EXTRACT(EPOCH FROM (e.ts - ${paymentDate.toISOString()}::timestamptz)))
    LIMIT 5
  `;

  // 2. Найти соответствующие записи в history
  const matchingHistory = await sql`
    SELECT h.id, h.branch, h.ts, h.operation_type, h.entity_id
    FROM history h
    WHERE h.branch = ${branch}
    AND h.ts BETWEEN ${timeFrom.toISOString()} AND ${timeTo.toISOString()}
    AND (
      h.entity_id = ${String(rentprogCountId)}
      OR h.operation_id = ${String(rentprogCountId)}
    )
    ORDER BY ABS(EXTRACT(EPOCH FROM (h.ts - ${paymentDate.toISOString()}::timestamptz)))
    LIMIT 5
  `;

  let linksCreated = 0;

  // 3. Создать связи
  if (autoCreate) {
    for (const event of matchingEvents) {
      const timeDiff = Math.abs(new Date(event.ts) - new Date(paymentDate)) / 1000;
      const confidence = timeDiff < 60 ? 'high' : timeDiff < 180 ? 'medium' : 'low';

      try {
        await sql`
          INSERT INTO event_links (
            entity_type,
            event_id,
            payment_id,
            rp_entity_id,
            rp_company_id,
            link_type,
            confidence,
            matched_at,
            matched_by,
            metadata
          ) VALUES (
            'payment',
            ${event.id},
            ${paymentId},
            ${String(rentprogCountId)},
            ${event.company_id},
            'webhook_to_payment',
            ${confidence},
            NOW(),
            'backfill',
            ${JSON.stringify({ time_diff_seconds: timeDiff, event_type: event.type })}
          )
          ON CONFLICT DO NOTHING
        `;
        linksCreated++;
        console.log(`    ✓ Связь с event ${event.id} (${confidence}, ${timeDiff.toFixed(0)}s)`);
      } catch (err) {
        console.warn(`    ✗ Ошибка связи с event ${event.id}:`, err.message);
      }
    }

    for (const hist of matchingHistory) {
      const timeDiff = Math.abs(new Date(hist.ts) - new Date(paymentDate)) / 1000;
      const confidence = timeDiff < 60 ? 'high' : timeDiff < 180 ? 'medium' : 'low';

      try {
        await sql`
          INSERT INTO event_links (
            entity_type,
            history_id,
            payment_id,
            rp_entity_id,
            rp_company_id,
            link_type,
            confidence,
            matched_at,
            matched_by,
            metadata
          ) VALUES (
            'payment',
            ${hist.id},
            ${paymentId},
            ${String(rentprogCountId)},
            ${companyId},
            'history_to_payment',
            ${confidence},
            NOW(),
            'backfill',
            ${JSON.stringify({ time_diff_seconds: timeDiff, operation_type: hist.operation_type })}
          )
          ON CONFLICT DO NOTHING
        `;
        linksCreated++;
        console.log(`    ✓ Связь с history ${hist.id} (${confidence}, ${timeDiff.toFixed(0)}s)`);
      } catch (err) {
        console.warn(`    ✗ Ошибка связи с history ${hist.id}:`, err.message);
      }
    }
  }

  return {
    eventsFound: matchingEvents.length,
    historyFound: matchingHistory.length,
    linksCreated
  };
}

/**
 * Главная функция
 */
async function main() {
  console.log('🔗 Event Links Backfill - Связывание старых данных\n');

  try {
    // 1. Получить все несвязанные платежи напрямую из таблицы payments
    console.log('📊 Получаем несвязанные платежи...');
    const unlinkedPayments = await sql`
      SELECT 
        p.id,
        p.payment_date,
        p.raw_data
      FROM payments p
      WHERE NOT EXISTS (
        SELECT 1 
        FROM event_links el 
        WHERE el.payment_id = p.id
      )
      AND p.raw_data IS NOT NULL
      AND p.raw_data->>'id' IS NOT NULL
      AND p.raw_data->>'company_id' IS NOT NULL
      ORDER BY p.payment_date DESC
    `;

    console.log(`\nНайдено несвязанных платежей: ${unlinkedPayments.length}`);

    if (unlinkedPayments.length === 0) {
      console.log('\n✅ Все платежи уже связаны!');
      return;
    }

    // 2. Обработать каждый платеж
    let processed = 0;
    let totalLinksCreated = 0;
    let errors = 0;
    let skipped = 0;

    console.log('\n🔄 Начинаем связывание...\n');

    for (const payment of unlinkedPayments) {
      try {
        const paymentId = payment.id;
        const rentprogCountId = parseInt(payment.raw_data.id, 10);
        const paymentDate = new Date(payment.payment_date);
        const companyId = parseInt(payment.raw_data.company_id, 10);
        const branch = COMPANY_ID_TO_BRANCH[companyId];

        if (!paymentId || !rentprogCountId || !branch) {
          skipped++;
          console.warn(`⚠️  Пропущен платеж ${paymentId || 'unknown'} (company_id: ${companyId}, нет маппинга на branch)`);
          continue;
        }

        const result = await linkPayment(
          paymentId,
          branch,
          rentprogCountId,
          paymentDate,
          { timeWindowSeconds: 300, autoCreate: true }
        );

        processed++;
        totalLinksCreated += result.linksCreated;

        if (result.linksCreated > 0) {
          console.log(`  ✅ Создано связей: ${result.linksCreated}\n`);
        } else {
          console.log(`  ⚠️  Не найдено совпадений\n`);
        }

        // Пауза каждые 10 записей
        if (processed % 10 === 0) {
          console.log(`--- Обработано: ${processed}/${unlinkedPayments.length} ---\n`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (err) {
        errors++;
        console.error(`❌ Ошибка обработки платежа:`, err.message);
      }
    }

    // 3. Итоговая статистика
    console.log('\n' + '='.repeat(60));
    console.log('📈 ИТОГИ БЭКФИЛЛА');
    console.log('='.repeat(60));
    console.log(`Обработано платежей: ${processed}`);
    console.log(`Пропущено (нет данных): ${skipped}`);
    console.log(`Создано связей: ${totalLinksCreated}`);
    console.log(`Ошибок: ${errors}`);
    if (processed > 0) {
      console.log(`Средн. связей на платеж: ${(totalLinksCreated / processed).toFixed(2)}`);
    }

    // 4. Проверить сколько осталось несвязанных
    const stillUnlinked = await sql`
      SELECT COUNT(*) as count
      FROM payments p
      WHERE NOT EXISTS (
        SELECT 1 
        FROM event_links el 
        WHERE el.payment_id = p.id
      )
    `;

    console.log(`\nНесвязанных платежей осталось: ${stillUnlinked[0].count}`);

    if (stillUnlinked[0].count === 0) {
      console.log('\n🎉 Все платежи успешно связаны!');
    } else {
      console.log('\n⚠️  Некоторые платежи остались несвязанными (нет совпадающих events/history или нет данных)');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

