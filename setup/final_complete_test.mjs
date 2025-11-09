#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function finalCompleteTest() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🎯 ФИНАЛЬНЫЙ ПОЛНЫЙ ТЕСТ\n');
  
  try {
    // Очистка предыдущих тестовых данных
    await sql`DELETE FROM bookings WHERE id IN (
      SELECT entity_id FROM external_refs 
      WHERE external_id IN ('555555', '666666') 
      AND system = 'rentprog' 
      AND entity_type = 'booking'
    )`;
    await sql`DELETE FROM external_refs WHERE external_id IN ('555555', '666666', '55555', '66666') AND system = 'rentprog'`;
    await sql`DELETE FROM rentprog_employees WHERE rentprog_id IN ('55555', '66666')`;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('ТЕСТ 1: Создание НОВОЙ брони через dynamic_upsert_entity');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const bookingData1 = {
      id: 555555,
      responsible_id: '55555',
      responsible: 'Иван Иванов',
      state: 'planned',
      price: 1000
    };
    
    console.log('📝 Вызов dynamic_upsert_entity с данными:');
    console.log('  ', JSON.stringify(bookingData1, null, 2));
    
    const result1 = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        '555555'::TEXT,
        ${sql.json(bookingData1)}
      )
    `.then(rows => rows[0]);
    
    console.log('\n✅ Результат:');
    console.log(`   entity_id: ${result1.entity_id}`);
    console.log(`   created: ${result1.created}`);
    
    // Проверка booking
    const booking1 = await sql`
      SELECT 
        b.id,
        b.data,
        b.responsible_id,
        re.rentprog_id as employee_rp_id,
        re.name as employee_name
      FROM bookings b
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE b.id = ${result1.entity_id}
    `.then(rows => rows[0]);
    
    console.log('\n📊 Booking в БД:');
    console.log(`   data: ${JSON.stringify(booking1.data)}`);
    console.log(`   responsible_id: ${booking1.responsible_id || 'NULL'}`);
    
    if (booking1.responsible_id) {
      console.log(`   ✅ Сотрудник: ${booking1.employee_name} (RentProg ID: ${booking1.employee_rp_id})`);
    } else {
      console.log('   ❌ responsible_id пуст!');
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('ТЕСТ 2: Обновление с массивом [old, new]');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const bookingData2 = {
      id: 555555,
      responsible_id: ['55555', '66666'],
      responsible: ['Иван Иванов', 'Петр Петров'],
      state: 'active',
      price: 1500
    };
    
    console.log('📝 Обновление с данными:');
    console.log('  ', JSON.stringify(bookingData2, null, 2));
    
    await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        '555555'::TEXT,
        ${sql.json(bookingData2)}
      )
    `;
    
    // Проверка обновления
    const booking2 = await sql`
      SELECT 
        b.id,
        b.data,
        b.responsible_id,
        re.rentprog_id as employee_rp_id,
        re.name as employee_name
      FROM bookings b
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE b.id = ${result1.entity_id}
    `.then(rows => rows[0]);
    
    console.log('\n📊 После обновления:');
    console.log(`   responsible_id: ${booking2.responsible_id || 'NULL'}`);
    
    if (booking2.responsible_id && booking2.employee_rp_id === '66666') {
      console.log(`   ✅ Обновлено на: ${booking2.employee_name} (RentProg ID: ${booking2.employee_rp_id})`);
    } else {
      console.log(`   ❌ Не обновилось! Текущий: ${booking2.employee_rp_id || 'NULL'}`);
    }
    
    // Проверка что оба сотрудника созданы
    const employees = await sql`
      SELECT rentprog_id, name 
      FROM rentprog_employees 
      WHERE rentprog_id IN ('55555', '66666')
      ORDER BY rentprog_id
    `;
    
    console.log('\n📊 Сотрудники в БД:');
    employees.forEach(e => {
      console.log(`   ${e.rentprog_id}: ${e.name}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 ИТОГОВАЯ ПРОВЕРКА');
    console.log('═══════════════════════════════════════════════════════\n');
    
    let allPassed = true;
    
    // Проверка 1: Оба сотрудника созданы
    if (employees.length === 2) {
      console.log('✅ Оба сотрудника созданы');
    } else {
      console.log(`❌ Создано только ${employees.length} сотрудников`);
      allPassed = false;
    }
    
    // Проверка 2: responsible_id заполнен
    if (booking2.responsible_id) {
      console.log('✅ bookings.responsible_id заполнен');
    } else {
      console.log('❌ bookings.responsible_id пуст');
      allPassed = false;
    }
    
    // Проверка 3: Указывает на правильного сотрудника (нового)
    if (booking2.employee_rp_id === '66666') {
      console.log('✅ responsible_id указывает на НОВОГО сотрудника (66666)');
    } else {
      console.log(`❌ responsible_id указывает не туда: ${booking2.employee_rp_id}`);
      allPassed = false;
    }
    
    // Проверка 4: data очищен
    if (Object.keys(booking2.data || {}).length === 0) {
      console.log('✅ data очищен (триггер сработал)');
    } else {
      console.log('❌ data НЕ очищен');
      allPassed = false;
    }
    
    if (allPassed) {
      console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
    } else {
      console.log('\n⚠️  Есть проблемы, требуется доработка');
    }
    
    // Очистка
    console.log('\n🧹 Очистка тестовых данных...');
    await sql`DELETE FROM bookings WHERE id = ${result1.entity_id}`;
    await sql`DELETE FROM external_refs WHERE external_id IN ('555555', '55555', '66666') AND system = 'rentprog'`;
    await sql`DELETE FROM rentprog_employees WHERE rentprog_id IN ('55555', '66666')`;
    console.log('✅ Очищено');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

finalCompleteTest();

