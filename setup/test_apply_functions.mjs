#!/usr/bin/env node
/**
 * Тест функций автоматического применения изменений на реальных данных
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testFunctions() {
  console.log('🧪 Тестирование функций на реальных данных\n');
  
  // Тест 1: Парсинг описаний из реальных записей history
  console.log('📝 Тест 1: Парсинг реальных записей history с машиной 39736\n');
  
  const testDesc = 'CEO Eliseev Aleksei изменил , company_id с 11163 на 9247 в авто № 39736 - Mini 4x4 S Red 919';
  const parsed = await sql`SELECT * FROM parse_field_change(${testDesc})`;
  
  if (parsed.length > 0) {
    console.log(`  ✅ Парсинг успешен:`);
    console.log(`     Поле: ${parsed[0].field_name}`);
    console.log(`     Старое значение: ${parsed[0].old_value}`);
    console.log(`     Новое значение: ${parsed[0].new_value}`);
  } else {
    console.log(`  ❌ Не удалось распарсить`);
  }
  
  // Тест 2: Проверка текущего состояния машины 39736
  console.log('\n🚗 Тест 2: Текущее состояние машины 39736\n');
  
  const car = await sql`
    SELECT 
      c.id, 
      c.branch, 
      c.car_class, 
      c.mileage,
      c.license_plate,
      c.status,
      er.external_id as rentprog_id
    FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    WHERE er.entity_type = 'car' 
      AND er.system = 'rentprog' 
      AND er.external_id = '39736'
  `;
  
  if (car.length > 0) {
    console.log(`  ✅ Машина найдена в БД:`);
    console.log(`     UUID: ${car[0].id}`);
    console.log(`     RentProg ID: ${car[0].rentprog_id}`);
    console.log(`     Branch: ${car[0].branch}`);
    console.log(`     Car Class: ${car[0].car_class || 'NULL'}`);
    console.log(`     Mileage: ${car[0].mileage || 'NULL'}`);
    console.log(`     License Plate: ${car[0].license_plate || 'NULL'}`);
    console.log(`     Status: ${car[0].status || 'NULL'}`);
  } else {
    console.log(`  ❌ Машина 39736 не найдена в БД`);
    return;
  }
  
  // Тест 3: Применение изменения company_id (если текущий branch не tbilisi)
  if (car[0].branch !== 'tbilisi') {
    console.log(`\n🔧 Тест 3: Применение изменения company_id (${car[0].branch} → tbilisi)\n`);
    
    const result = await sql`
      SELECT * FROM apply_car_change('39736', 'company_id', '9247', '11158')
    `;
    
    console.log(`  ${result[0].success ? '✅' : '❌'} ${result[0].message}`);
    console.log(`     Обновлено строк: ${result[0].rows_affected}`);
    
    // Проверяем результат
    const carAfter = await sql`
      SELECT c.branch
      FROM cars c
      JOIN external_refs er ON er.entity_id = c.id
      WHERE er.entity_type = 'car' 
        AND er.system = 'rentprog' 
        AND er.external_id = '39736'
    `;
    console.log(`     Новый branch: ${carAfter[0].branch}`);
  } else {
    console.log(`\n⏭️  Тест 3: Пропущен (машина уже в tbilisi)\n`);
  }
  
  // Тест 4: Поиск записей в history для применения
  console.log('\n📜 Тест 4: Поиск записей в history с изменениями для машины 39736\n');
  
  const historyWithChanges = await sql`
    SELECT h.id, h.description, h.created_at,
           p.field_name, p.old_value, p.new_value
    FROM history h
    CROSS JOIN LATERAL parse_field_change(h.description) p
    WHERE h.entity_id = '39736' 
      AND h.entity_type = 'car'
      AND h.operation_type = 'update'
      AND p.field_name IS NOT NULL
    ORDER BY h.created_at DESC
    LIMIT 5
  `;
  
  if (historyWithChanges.length > 0) {
    console.log(`  ✅ Найдено записей с изменениями: ${historyWithChanges.length}\n`);
    
    for (const record of historyWithChanges) {
      console.log(`  📌 History ID: ${record.id}`);
      console.log(`     Поле: ${record.field_name}`);
      console.log(`     Изменение: ${record.old_value} → ${record.new_value}`);
      console.log(`     Дата: ${new Date(record.created_at).toLocaleString('ru-RU')}`);
      console.log(`     Описание: ${record.description.substring(0, 80)}...`);
      console.log('');
    }
    
    // Применяем изменения из первой записи
    const firstRecord = historyWithChanges[0];
    console.log(`  🔧 Применяю изменения из history ID ${firstRecord.id}...\n`);
    
    const applyResult = await sql`
      SELECT * FROM apply_changes_from_history(${firstRecord.id})
    `;
    
    for (const result of applyResult) {
      console.log(`     ${result.applied ? '✅' : '❌'} ${result.field_name}: ${result.old_value} → ${result.new_value}`);
      console.log(`        ${result.message}`);
    }
    
  } else {
    console.log(`  ⚠️  Записей с изменениями не найдено`);
  }
  
  // Тест 5: Просмотр логов applied_changes
  console.log('\n📊 Тест 5: Лог примененных изменений\n');
  
  const appliedChanges = await sql`
    SELECT entity_id, field_name, old_value, new_value, applied, error, ts
    FROM applied_changes
    WHERE entity_id = '39736'
    ORDER BY ts DESC
    LIMIT 5
  `;
  
  if (appliedChanges.length > 0) {
    console.log(`  ✅ Найдено записей в логе: ${appliedChanges.length}\n`);
    
    for (const change of appliedChanges) {
      console.log(`  ${change.applied ? '✅' : '❌'} ${change.field_name}: ${change.old_value} → ${change.new_value}`);
      console.log(`     Время: ${new Date(change.ts).toLocaleString('ru-RU')}`);
      if (!change.applied) {
        console.log(`     Ошибка: ${change.error}`);
      }
      console.log('');
    }
  } else {
    console.log(`  ℹ️  Записей в логе пока нет`);
  }
  
  console.log('✅ Все тесты завершены!\n');
}

testFunctions()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Ошибка:', error.message);
    await sql.end();
    process.exit(1);
  });

