#!/usr/bin/env node
/**
 * Связывание записей из history с событиями из events
 * 
 * Правила связывания:
 * - "изменил" в history → "update" в events
 * - "создал" в history → "create" в events
 * 
 * Связь по:
 * - entity_type и entity_id (rp_entity_id)
 * - company_id (branch)
 * - время (окно ±5 минут)
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем connection string из .env или используем дефолтный
const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Извлечение entity_id и entity_type из description
 */
function parseEntityFromDescription(description) {
  if (!description) return null;
  
  // Авто: "авто № 39736", "car #39736", "машина № 39736"
  const carMatch = description.match(/(?:авто|car|машина|автомобиль)[\s#№]*(\d+)/i);
  if (carMatch) {
    return { entity_type: 'car', entity_id: carMatch[1] };
  }
  
  // Бронь: "бронь № 506974", "booking #506974"
  const bookingMatch = description.match(/(?:бронь|booking|бронирование)[\s#№]*(\d+)/i);
  if (bookingMatch) {
    return { entity_type: 'booking', entity_id: bookingMatch[1] };
  }
  
  // Клиент: "клиент № 381606", "client #381606"
  const clientMatch = description.match(/(?:клиент|client)[\s#№]*(\d+)/i);
  if (clientMatch) {
    return { entity_type: 'client', entity_id: clientMatch[1] };
  }
  
  // Платеж: "платёж №1840037", "payment #1840037"
  const paymentMatch = description.match(/(?:плат[ёе]ж|payment)[\s#№]*(\d+)/i);
  if (paymentMatch) {
    return { entity_type: 'payment', entity_id: paymentMatch[1] };
  }
  
  return null;
}

/**
 * Определение операции из description
 */
function parseOperation(description) {
  if (!description) return null;
  
  if (description.match(/изменил|changed|updated/i)) {
    return 'update';
  }
  if (description.match(/создал|created/i)) {
    return 'create';
  }
  if (description.match(/удалил|deleted/i)) {
    return 'delete';
  }
  
  return null;
}

/**
 * Получение company_id из branch
 */
async function getCompanyIdByBranch(branch) {
  const result = await sql`
    SELECT company_id FROM branches WHERE code = ${branch} LIMIT 1
  `;
  return result[0]?.company_id || null;
}

/**
 * Получение branch из company_id
 */
async function getBranchByCompanyId(companyId) {
  const result = await sql`
    SELECT code FROM branches WHERE company_id = ${companyId} LIMIT 1
  `;
  return result[0]?.code || null;
}

/**
 * Связывание history с events
 */
async function linkHistoryToEvents() {
  console.log('🔗 Начинаю связывание history с events...\n');
  
  // Получаем все не связанные записи из history с "изменил" или "создал"
  const historyRecords = await sql`
    SELECT 
      h.id,
      h.branch,
      h.description,
      h.entity_type,
      h.entity_id,
      h.created_at,
      h.raw_data,
      h.matched
    FROM history h
    WHERE 
      h.matched = FALSE
      AND (
        h.description ~* 'изменил|создал'
        OR h.description IS NULL
      )
      AND h.entity_type IS NOT NULL
      AND h.entity_id IS NOT NULL
    ORDER BY h.created_at DESC
    LIMIT 1000
  `;
  
  console.log(`📊 Найдено ${historyRecords.length} записей для обработки\n`);
  
  let linked = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const history of historyRecords) {
    try {
      // Парсим entity из description если не заполнено
      let entityType = history.entity_type;
      let entityId = history.entity_id;
      
      if (!entityType || !entityId) {
        const parsed = parseEntityFromDescription(history.description);
        if (parsed) {
          entityType = parsed.entity_type;
          entityId = parsed.entity_id;
        } else {
          console.log(`⚠️  Пропущено: не удалось извлечь entity из description (ID: ${history.id})`);
          skipped++;
          continue;
        }
      }
      
      // Определяем операцию
      const operation = parseOperation(history.description);
      if (!operation) {
        console.log(`⚠️  Пропущено: не удалось определить операцию (ID: ${history.id})`);
        skipped++;
        continue;
      }
      
      // Получаем company_id для branch
      const companyId = await getCompanyIdByBranch(history.branch);
      if (!companyId) {
        console.log(`⚠️  Пропущено: не найден company_id для branch ${history.branch} (ID: ${history.id})`);
        skipped++;
        continue;
      }
      
      // Ищем соответствующее событие в events
      // Окно времени: ±5 минут
      const timeWindow = 5 * 60; // 5 минут в секундах
      
      // Формируем тип события: car_update, booking_create и т.д.
      const eventType = `${entityType}_${operation}`;
      
      // Ищем по rentprog_id (RentProg ID) - это основной ID
      const matchingEvents = await sql`
        SELECT 
          e.id,
          e.type,
          e.company_id,
          e.payload,
          e.ts,
          e.rentprog_id,
          e.ext_id
        FROM events e
        WHERE 
          e.company_id = ${companyId}
          AND e.type = ${eventType}
          AND (e.rentprog_id = ${entityId} OR e.ext_id = ${entityId})
          AND ABS(EXTRACT(EPOCH FROM (e.ts - ${history.created_at}))) < ${timeWindow}
        ORDER BY ABS(EXTRACT(EPOCH FROM (e.ts - ${history.created_at})))
        LIMIT 1
      `;
      
      if (matchingEvents.length > 0) {
        const event = matchingEvents[0];
        
        // Создаем связь в event_links
        await sql`
          INSERT INTO event_links (
            entity_type,
            rp_entity_id,
            rp_company_id,
            event_id,
            history_id,
            link_type,
            confidence,
            matched_at,
            matched_by
          ) VALUES (
            ${entityType},
            ${entityId},
            ${companyId},
            ${event.id},
            ${history.id},
            'webhook_to_history',
            'high',
            NOW(),
            'auto'
          )
          ON CONFLICT DO NOTHING
        `;
        
        // Обновляем matched в history
        await sql`
          UPDATE history
          SET matched = TRUE
          WHERE id = ${history.id}
        `;
        
        linked++;
        console.log(`✅ Связано: history ${history.id} ↔ event ${event.id} (${entityType} #${entityId}, ${operation})`);
      } else {
        skipped++;
        console.log(`⚠️  Не найдено событие для history ${history.id} (${entityType} #${entityId}, ${operation}, branch: ${history.branch})`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Ошибка при обработке history ${history.id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Итого:`);
  console.log(`   ✅ Связано: ${linked}`);
  console.log(`   ⚠️  Пропущено: ${skipped}`);
  console.log(`   ❌ Ошибок: ${errors}`);
}

// Запуск
linkHistoryToEvents()
  .then(() => {
    console.log('\n✅ Связывание завершено');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  })
  .finally(() => {
    sql.end();
  });

