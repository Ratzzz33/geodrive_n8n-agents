#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function finalTest() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🧪 Финальный тест триггера\n');
  
  try {
    // Очистка старых тестовых данных
    await sql`DELETE FROM bookings WHERE id IN (
      SELECT entity_id FROM external_refs WHERE external_id IN ('777777', '888888') AND system = 'rentprog' AND entity_type = 'booking'
    )`;
    await sql`DELETE FROM external_refs WHERE external_id IN ('777777', '888888', '77777', '88888', '88889') AND system = 'rentprog'`;
    await sql`DELETE FROM rentprog_employees WHERE rentprog_id IN ('77777', '88888', '88889')`;
    
    // Тест 1: Создание новой брони с responsible_id
    console.log('📝 Тест 1: Создание новой брони через dynamic_upsert_entity...');
    
    const testData1 = {
      id: 777777,
      responsible_id: '77777',
      responsible: 'Тестовый Сотрудник 77777',
      state: 'active'
    };
    
    const result1 = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        '777777'::TEXT,
        ${JSON.stringify(testData1)}::JSONB
      )
    `.then(rows => rows[0]);
    
    console.log(`   Booking created: ${result1.created}`);
    console.log(`   Booking ID: ${result1.entity_id}`);
    
    // Проверка сотрудника
    const employee1 = await sql`
      SELECT re.rentprog_id, re.name 
      FROM rentprog_employees re
      WHERE re.rentprog_id = '77777'
    `.then(rows => rows[0]);
    
    if (employee1) {
      console.log(`   ✅ Сотрудник создан: ${employee1.name}`);
    } else {
      console.log('   ❌ Сотрудник НЕ создан');
    }
    
    // Проверка responsible_id в booking
    const booking1 = await sql`
      SELECT b.id, b.responsible_id, re.name as responsible_name
      FROM bookings b
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE b.id = ${result1.entity_id}
    `.then(rows => rows[0]);
    
    if (booking1.responsible_id) {
      console.log(`   ✅ booking.responsible_id заполнен: ${booking1.responsible_name}`);
    } else {
      console.log('   ❌ booking.responsible_id пуст');
    }
    
    // Тест 2: UPDATE с массивом [old, new]
    console.log('\n📝 Тест 2: Обновление брони с массивом [old, new]...');
    
    const testData2 = {
      id: 777777,
      responsible_id: ['77777', '88888'],
      responsible: ['Тестовый Сотрудник 77777', 'Новый Сотрудник 88888'],
      state: 'active'
    };
    
    await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        '777777'::TEXT,
        ${JSON.stringify(testData2)}::JSONB
      )
    `;
    
    // Проверка нового сотрудника
    const employee2 = await sql`
      SELECT rentprog_id, name 
      FROM rentprog_employees 
      WHERE rentprog_id = '88888'
    `.then(rows => rows[0]);
    
    if (employee2) {
      console.log(`   ✅ Новый сотрудник создан: ${employee2.name}`);
    } else {
      console.log('   ❌ Новый сотрудник НЕ создан');
    }
    
    // Проверка обновления responsible_id
    const booking2 = await sql`
      SELECT b.id, b.responsible_id, re.rentprog_id, re.name as responsible_name
      FROM bookings b
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE b.id = ${result1.entity_id}
    `.then(rows => rows[0]);
    
    if (booking2.responsible_id && booking2.rentprog_id === '88888') {
      console.log(`   ✅ booking.responsible_id обновлен: ${booking2.responsible_name}`);
    } else {
      console.log(`   ❌ booking.responsible_id не обновился (сейчас: ${booking2.rentprog_id || 'null'})`);
    }
    
    // Очистка
    console.log('\n🧹 Очистка тестовых данных...');
    await sql`DELETE FROM bookings WHERE id = ${result1.entity_id}`;
    await sql`DELETE FROM external_refs WHERE external_id IN ('777777', '77777', '88888') AND system = 'rentprog'`;
    await sql`DELETE FROM rentprog_employees WHERE rentprog_id IN ('77777', '88888')`;
    console.log('   ✅ Очищено');
    
    console.log('\n✅ Тесты завершены!');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

finalTest();

