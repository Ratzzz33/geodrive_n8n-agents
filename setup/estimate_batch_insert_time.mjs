#!/usr/bin/env node
/**
 * Оценка времени batch insert для разных объемов
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false },
  max: 1
});

console.log('\n⏱️  Оценка времени batch insert...\n');

// Генерируем тестовые данные разных размеров
function generateTestData(count) {
  return Array.from({ length: count }, (_, i) => ({
    branch: ['tbilisi', 'batumi', 'kutaisi', 'service-center'][i % 4],
    number: 800000 + i,
    is_active: i % 2 === 0,
    start_date: '2025-11-15T10:00:00Z',
    end_date: '2025-11-20T10:00:00Z',
    start_date_formatted: '15.11.2025 10:00',
    end_date_formatted: '20.11.2025 10:00',
    client_id: null,
    client_name: `Client ${i}`,
    client_category: 'Standard',
    car_id: null,
    car_name: `Car ${i}`,
    car_code: `CODE-${i}`,
    location_start: 'Location A',
    location_end: 'Location B',
    total: 100 + i,
    deposit: 50,
    rental_cost: 50 + i,
    days: 5,
    state: 'planned',
    in_rent: false,
    archive: false,
    start_worker_id: '14714',
    end_worker_id: null,
    responsible: 'Test',
    description: `Test booking ${i}`,
    source: 'api',
    data: { test: true, index: i }
  }));
}

async function testBatchSize(size, withTrigger = true) {
  const testData = generateTestData(size);
  
  const triggerStatus = withTrigger ? 'С триггером' : 'БЕЗ триггера';
  console.log(`\n📦 Тест: ${size} записей (${triggerStatus})`);
  
  try {
    // Отключаем триггер если нужно
    if (!withTrigger) {
      await sql`ALTER TABLE bookings DISABLE TRIGGER process_booking_nested_entities_trigger`;
      await sql`ALTER TABLE bookings DISABLE TRIGGER bookings_sync_fields_trigger`;
    }
    
    const startTime = Date.now();
    
    const result = await sql`
      INSERT INTO bookings ${sql(testData, 
        'branch', 'number', 'is_active',
        'start_date', 'end_date', 'start_date_formatted', 'end_date_formatted',
        'client_id', 'client_name', 'client_category',
        'car_id', 'car_name', 'car_code',
        'location_start', 'location_end',
        'total', 'deposit', 'rental_cost', 'days',
        'state', 'in_rent', 'archive',
        'start_worker_id', 'end_worker_id', 'responsible',
        'description', 'source', 'data'
      )}
      ON CONFLICT (branch, number) 
      DO UPDATE SET
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING id
    `;
    
    const duration = Date.now() - startTime;
    const perRecord = (duration / size).toFixed(2);
    
    console.log(`   ⏱️  Время: ${duration}ms (${perRecord}ms на запись)`);
    console.log(`   ✅ Сохранено: ${result.length} записей`);
    
    // Включаем триггер обратно
    if (!withTrigger) {
      await sql`ALTER TABLE bookings ENABLE TRIGGER process_booking_nested_entities_trigger`;
      await sql`ALTER TABLE bookings ENABLE TRIGGER bookings_sync_fields_trigger`;
    }
    
    // Удаляем тестовые данные
    await sql`DELETE FROM bookings WHERE number >= 800000`;
    
    return { size, duration, perRecord, withTrigger };
    
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}`);
    
    // Включаем триггер обратно в случае ошибки
    if (!withTrigger) {
      await sql`ALTER TABLE bookings ENABLE TRIGGER process_booking_nested_entities_trigger`;
      await sql`ALTER TABLE bookings ENABLE TRIGGER bookings_sync_fields_trigger`;
    }
    
    return null;
  }
}

try {
  console.log('🔬 Запуск тестов производительности...\n');
  
  const results = [];
  
  // Тесты с триггером
  results.push(await testBatchSize(10, true));
  results.push(await testBatchSize(100, true));
  results.push(await testBatchSize(500, true));
  results.push(await testBatchSize(1000, true));
  
  // Тесты БЕЗ триггера
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  results.push(await testBatchSize(1000, false));
  results.push(await testBatchSize(2000, false));
  results.push(await testBatchSize(5000, false));
  
  // Итоговая таблица
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Итоговая таблица:\n');
  console.log('┌────────────┬──────────────┬──────────────┬──────────────┐');
  console.log('│  Записей   │   С триггер  │  БЕЗ триггер │   Выигрыш    │');
  console.log('├────────────┼──────────────┼──────────────┼──────────────┤');
  
  const grouped = {};
  results.filter(r => r).forEach(r => {
    if (!grouped[r.size]) grouped[r.size] = {};
    grouped[r.size][r.withTrigger ? 'with' : 'without'] = r.duration;
  });
  
  Object.entries(grouped).forEach(([size, times]) => {
    const withT = times.with || '-';
    const withoutT = times.without || '-';
    const speedup = (times.with && times.without) 
      ? `${(times.with / times.without).toFixed(1)}x` 
      : '-';
    
    console.log(`│ ${String(size).padStart(10)} │ ${String(withT).padStart(10)}ms │ ${String(withoutT).padStart(10)}ms │ ${String(speedup).padStart(12)} │`);
  });
  
  console.log('└────────────┴──────────────┴──────────────┴──────────────┘\n');
  
  // Экстраполяция для 13000
  const avg1000 = results.find(r => r && r.size === 1000 && !r.withTrigger);
  if (avg1000) {
    const estimated13k = Math.round((avg1000.duration / 1000) * 13000);
    const estimatedMinutes = (estimated13k / 1000 / 60).toFixed(1);
    
    console.log('🎯 Оценка для 13000 записей:');
    console.log(`   БЕЗ триггера: ~${estimated13k}ms (${estimatedMinutes} минут)`);
    
    const withTrigger1000 = results.find(r => r && r.size === 1000 && r.withTrigger);
    if (withTrigger1000) {
      const estimated13kWith = Math.round((withTrigger1000.duration / 1000) * 13000);
      const estimatedMinutesWith = (estimated13kWith / 1000 / 60).toFixed(1);
      console.log(`   С триггером:  ~${estimated13kWith}ms (${estimatedMinutesWith} минут)`);
    }
  }
  
  console.log('\n💡 Рекомендация:');
  console.log('   Для первичной загрузки больших объемов (>5000):');
  console.log('   1. Отключи триггеры');
  console.log('   2. Сделай batch insert');
  console.log('   3. Включи триггеры обратно');
  console.log('   4. Для регулярного парсинга (~2000 записей) - оставь триггеры\n');
  
} catch (error) {
  console.error('❌ Критическая ошибка:', error.message);
} finally {
  await sql.end();
}

