#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🧪 Тестирование триггера extract_rentprog_employees\n');
  console.log('='.repeat(60));

  try {
    const testEmployeeId = '99999';
    const testEmployeeName = 'Test Employee';
    const testRentprogId = 'test-booking-' + Date.now();

    console.log('\n1️⃣ Создание тестовой брони с сотрудником...');
    console.log(`   Employee ID: ${testEmployeeId}`);
    console.log(`   Employee Name: ${testEmployeeName}`);

    // Создаем тестовую бронь с сотрудником
    const testBooking = await sql`
      INSERT INTO bookings (data)
      VALUES (
        jsonb_build_object(
          'id', floor(random() * 10000)::int,
          'responsible_id', ${testEmployeeId},
          'responsible', ${testEmployeeName},
          'start_worker_id', '88888',
          'start_worker_name', 'Start Worker'
        )
      )
      RETURNING id, data
    `.then(rows => rows[0]);
    
    console.log(`   ✅ Тестовая бронь создана: ${testBooking.id}`);
    console.log(`   📦 Data: ${JSON.stringify(testBooking.data, null, 2)}`);

    // Даем время триггеру
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('\n2️⃣ Проверка создания сотрудников...');
    
    // Проверяем сотрудников
    const employees = await sql`
      SELECT * FROM rentprog_employees
      WHERE rentprog_id IN (${testEmployeeId}, '88888')
    `;
    
    if (employees.length > 0) {
      console.log(`   ✅ Сотрудники автоматически созданы: ${employees.length}`);
      employees.forEach(emp => {
        console.log(`      - ID: ${emp.rentprog_id} | ${emp.name}`);
      });
    } else {
      console.log('   ❌ Сотрудники НЕ созданы');
      console.log('   💡 Проверьте триггер');
    }

    // Проверяем external_refs
    console.log('\n3️⃣ Проверка external_refs...');
    const refs = await sql`
      SELECT * FROM external_refs
      WHERE external_id IN (${testEmployeeId}, '88888')
        AND entity_type = 'rentprog_employee'
    `;
    
    console.log(`   📊 External refs: ${refs.length}`);
    refs.forEach(ref => {
      console.log(`      - ${ref.external_id} → ${ref.entity_id}`);
    });

    // Тестируем UPDATE с массивами [old, new]
    console.log('\n4️⃣ Тестирование UPDATE с массивами [old, new]...');
    
    await sql`
      UPDATE bookings
      SET data = jsonb_build_object(
        'id', 12345,
        'responsible_id', jsonb_build_array(${testEmployeeId}, '77777'),
        'responsible', jsonb_build_array(${testEmployeeName}, 'New Employee')
      )
      WHERE id = ${testBooking.id}
    `;
    
    console.log('   ✅ UPDATE выполнен с массивами [old, new]');

    await new Promise(resolve => setTimeout(resolve, 200));

    const newEmployee = await sql`
      SELECT * FROM rentprog_employees WHERE rentprog_id = '77777'
    `;
    
    if (newEmployee.length > 0) {
      console.log(`   ✅ Новый сотрудник создан из массива:`);
      console.log(`      ID: ${newEmployee[0].rentprog_id} | ${newEmployee[0].name}`);
    } else {
      console.log('   ❌ Сотрудник из массива НЕ создан');
    }

    // Удаляем тестовые данные
    console.log('\n5️⃣ Очистка тестовых данных...');
    await sql`DELETE FROM bookings WHERE id = ${testBooking.id}`;
    await sql`DELETE FROM rentprog_employees WHERE rentprog_id IN (${testEmployeeId}, '88888', '77777')`;
    await sql`DELETE FROM external_refs WHERE external_id IN (${testEmployeeId}, '88888', '77777')`;
    console.log('   🧹 Тестовые данные удалены');

    console.log('\n✅ Тест завершен!');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

