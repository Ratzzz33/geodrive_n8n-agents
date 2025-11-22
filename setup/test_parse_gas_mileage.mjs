#!/usr/bin/env node

/**
 * Test: Check what parse_history_description extracts from gas_mileage change description
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function testParse() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🧪 Тестируем парсинг описания изменения gas_mileage...\n');

    const description = "CEO Eliseev Aleksei изменил , gas_mileage с 7.3 на 7.4 в авто № 39736 - Mini 4x4 S Red 919";

    console.log(`Описание: ${description}\n`);

    const result = await sql`
      SELECT * FROM parse_history_description(${description})
    `;

    if (result.length === 0) {
      console.log('❌ Парсер не вернул результатов');
      return;
    }

    const parsed = result[0];
    console.log('Результат парсинга:');
    console.log(`  entity_type: ${parsed.entity_type || 'NULL'}`);
    console.log(`  entity_id: ${parsed.entity_id || 'NULL'}`);
    console.log(`  operation: ${parsed.operation || 'NULL'}`);
    console.log(`  user_name: ${parsed.user_name || 'NULL'}`);
    console.log(`  amount: ${parsed.amount || 'NULL'}`);
    console.log(`  currency: ${parsed.currency || 'NULL'}`);
    console.log(`  extra: ${JSON.stringify(parsed.extra, null, 2)}`);

    if (parsed.extra && parsed.extra.changes) {
      console.log('\n✅ Изменения найдены:');
      console.log(JSON.stringify(parsed.extra.changes, null, 2));
      
      if (parsed.extra.changes.gas_mileage) {
        console.log(`\n✅ gas_mileage извлечён: "${parsed.extra.changes.gas_mileage}"`);
        if (parsed.extra.changes.gas_mileage === '7.4') {
          console.log('✅ Значение корректное!');
        } else {
          console.log(`❌ Значение неверное! Ожидалось "7.4", получено "${parsed.extra.changes.gas_mileage}"`);
          console.log('\n🔍 Проблема: regex останавливается на точке в числе!');
        }
      } else {
        console.log('\n❌ gas_mileage НЕ извлечён из изменений!');
      }
    } else {
      console.log('\n❌ Изменения НЕ найдены в extra!');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

testParse().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

