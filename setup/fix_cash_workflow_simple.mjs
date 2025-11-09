#!/usr/bin/env node
/**
 * Упрощение workflow Company Cash Monitor - убрать Split In Batches
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔧 Упрощение workflow Company Cash Monitor\n');

// Новый код для ноды "Save All Payments"
const saveAllPaymentsCode = `// Обрабатываем ВСЕ payments через batch insert
const items = $input.all();
console.log(\`Processing \${items.length} payments\`);

const results = [];
const batchSize = 50;

// Подключение к БД (из credentials)
const sql = $('PostgresQL').prepare;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  console.log(\`Batch \${Math.floor(i/batchSize) + 1}: \${batch.length} items\`);
  
  for (const item of batch) {
    try {
      // Upsert каждого payment
      const result = await sql\`
        INSERT INTO payments (
          branch, payment_id, sum, cash, cashless, "group", subgroup, description,
          car_id, booking_id, client_id, user_id, created_at, raw_data
        ) VALUES (
          \${item.json.branch},
          \${item.json.payment_id},
          \${item.json.sum},
          \${item.json.cash},
          \${item.json.cashless},
          \${item.json.group},
          \${item.json.subgroup},
          \${item.json.description},
          \${item.json.car_id},
          \${item.json.booking_id},
          \${item.json.client_id},
          \${item.json.user_id},
          \${item.json.created_at},
          \${item.json.raw_data}
        )
        ON CONFLICT (branch, payment_id)
        DO UPDATE SET
          sum = EXCLUDED.sum,
          cash = EXCLUDED.cash,
          cashless = EXCLUDED.cashless,
          description = EXCLUDED.description,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      \`;
      
      results.push({
        json: {
          branch: item.json.branch,
          payment_id: item.json.payment_id,
          success: true
        }
      });
    } catch (error) {
      console.error(\`Error saving payment \${item.json.payment_id}:\`, error.message);
      results.push({
        json: {
          branch: item.json.branch,
          payment_id: item.json.payment_id,
          error: error.message
        }
      });
    }
  }
}

console.log(\`✅ Processed \${results.length} payments\`);
return results;`;

console.log('📝 Новый код для упрощённой обработки:\n');
console.log('Будет обрабатывать ВСЕ payments за один раз через batches\n');
console.log('✅ Нужно вручную обновить workflow в n8n UI:\n');
console.log('1. Удалить ноды: "Split In Batches", "Pass Through Data"');
console.log('2. Переименовать "Save Payment to DB" → "Save All Payments"');
console.log('3. Изменить тип ноды на Code (JS)');
console.log('4. Вставить код выше');
console.log('5. Связать: Merge & Process → Save All Payments → Format Result\n');

console.log('Или используйте более простой вариант без цикла:\n');

// Альтернатива - обработка через SQL batch insert
console.log('АЛЬТЕРНАТИВА: Простая batch обработка без циклов\n');
console.log('Обработаем payments пачками по 20 через один Postgres запрос:');
console.log('Merge & Process → Code (prepare batches) → Postgres (batch insert) → Format Result');

