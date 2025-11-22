#!/usr/bin/env node
/**
 * Тест функций автоматического применения изменений
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testAutoApplyChanges() {
  console.log('🧪 Тестирование функций автоматического применения изменений\n');
  
  // Тест 1: Парсинг изменений из description
  console.log('📝 Тест 1: Парсинг изменений из description');
  const testDescriptions = [
    'CEO Eliseev Aleksei изменил , company_id с 11163 на 9247 в авто № 39736 - Mini 4x4 S Red 919',
    'CEO Eliseev Aleksei изменил car_class с Средний на Эконом, в авто № 39736 - Mini 4x4 S Red 919',
    'Neverov Leonid изменил , mileage с 171678 на 172851 в авто № 59439 - BMW X6 704'
  ];
  
  for (const desc of testDescriptions) {
    const changes = await sql`SELECT * FROM parse_field_change(${desc})`;
    if (changes.length > 0) {
      console.log(`  ✅ ${changes[0].field_name}: ${changes[0].old_value} → ${changes[0].new_value}`);
    } else {
      console.log(`  ❌ Не удалось распарсить: ${desc}`);
    }
  }
  
  // Тест 2: Проверка существования машины 39736
  console.log('\n🚗 Тест 2: Проверка существования машины 39736');
  const car = await sql`
    SELECT c.id, c.branch, c.car_class, c.mileage, er.external_id as rentprog_id
    FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    WHERE er.entity_type = 'car' 
      AND er.system = 'rentprog' 
      AND er.external_id = '39736'
  `;
  
  if (car.length > 0) {
    console.log(`  ✅ Машина найдена:`);
    console.log(`     ID: ${car[0].id}`);
    console.log(`     RentProg ID: ${car[0].rentprog_id}`);
    console.log(`     Branch: ${car[0].branch}`);
    console.log(`     Car Class: ${car[0].car_class || 'NULL'}`);
    console.log(`     Mileage: ${car[0].mileage || 'NULL'}`);
  } else {
    console.log(`  ❌ Машина 39736 не найдена в БД`);
  }
  
  // Тест 3: Применение изменений (DRY RUN - только проверка)
  console.log('\n🔧 Тест 3: Применение изменений (DRY RUN)');
  
  // Тест изменения company_id
  console.log('\n  📌 Изменение company_id 39736: service-center (11158) → tbilisi (9247)');
  const result1 = await sql`
    SELECT * FROM apply_car_change('39736', 'company_id', '9247', '11158')
  `;
  console.log(`     ${result1[0].success ? '✅' : '❌'} ${result1[0].message} (rows: ${result1[0].rows_affected})`);
  
  // Проверяем результат
  const carAfter = await sql`
    SELECT c.branch
    FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    WHERE er.entity_type = 'car' 
      AND er.system = 'rentprog' 
      AND er.external_id = '39736'
  `;
  console.log(`     Текущий branch: ${carAfter[0]?.branch || 'NULL'}`);
  
  // Тест 4: Поиск записей в history для машины 39736
  console.log('\n📜 Тест 4: Поиск записей в history для машины 39736');
  const historyRecords = await sql`
    SELECT id, operation_type, description, entity_type, entity_id, created_at
    FROM history
    WHERE entity_id = '39736' AND entity_type = 'car'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  
  if (historyRecords.length > 0) {
    console.log(`  ✅ Найдено записей: ${historyRecords.length}`);
    for (const record of historyRecords) {
      console.log(`\n     ID: ${record.id}`);
      console.log(`     Операция: ${record.operation_type}`);
      console.log(`     Описание: ${record.description}`);
      console.log(`     Дата: ${new Date(record.created_at).toLocaleString('ru-RU')}`);
      
      // Парсим изменения
      const changes = await sql`SELECT * FROM parse_field_change(${record.description})`;
      if (changes.length > 0) {
        console.log(`     Изменения: ${changes[0].field_name}: ${changes[0].old_value} → ${changes[0].new_value}`);
      }
    }
  } else {
    console.log(`  ⚠️  Записей в history не найдено`);
  }
  
  // Тест 5: Статистика по applied_changes
  console.log('\n📊 Тест 5: Статистика по примененным изменениям');
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN applied THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN NOT applied THEN 1 ELSE 0 END) as failed
    FROM applied_changes
  `;
  
  console.log(`  Всего записей: ${stats[0].total}`);
  console.log(`  Успешно: ${stats[0].success}`);
  console.log(`  Ошибок: ${stats[0].failed}`);
  
  if (stats[0].total > 0) {
    const recent = await sql`
      SELECT entity_type, entity_id, field_name, old_value, new_value, applied, error, ts
      FROM applied_changes
      ORDER BY ts DESC
      LIMIT 5
    `;
    
    console.log('\n  Последние изменения:');
    for (const change of recent) {
      console.log(`\n     ${change.entity_type} #${change.entity_id}`);
      console.log(`     ${change.field_name}: ${change.old_value} → ${change.new_value}`);
      console.log(`     ${change.applied ? '✅ Применено' : '❌ Ошибка: ' + change.error}`);
      console.log(`     ${new Date(change.ts).toLocaleString('ru-RU')}`);
    }
  }
  
  console.log('\n✅ Тестирование завершено!\n');
}

testAutoApplyChanges()
  .then(() => {
    console.log('Все тесты выполнены');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  });

