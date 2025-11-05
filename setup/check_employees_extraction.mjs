#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Проверка системы извлечения сотрудников\n');
  console.log('='.repeat(60));

  try {
    // 1. Проверка таблицы
    console.log('\n1️⃣ Проверка таблицы employees...');
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'employees'
      ) as exists
    `.then(rows => rows[0].exists);
    
    if (tableExists) {
      console.log('   ✅ Таблица employees существует');
    } else {
      console.log('   ❌ Таблица employees НЕ существует');
      console.log('   💡 Запустите: node setup/create_employees_extraction_trigger.mjs');
      return;
    }

    // 2. Проверка триггеров
    console.log('\n2️⃣ Проверка триггеров...');
    const triggers = await sql`
      SELECT 
        trigger_name,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_name LIKE '%extract_employees%'
    `;
    
    if (triggers.length > 0) {
      console.log('   ✅ Триггеры найдены:');
      triggers.forEach(t => {
        console.log(`      - ${t.trigger_name} на ${t.event_object_table}`);
      });
    } else {
      console.log('   ❌ Триггеры НЕ найдены');
    }

    // 3. Статистика сотрудников
    console.log('\n3️⃣ Статистика сотрудников...');
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(name) as with_names,
        COUNT(*) - COUNT(name) as without_names
      FROM employees
    `.then(rows => rows[0]);
    
    console.log(`   📊 Всего: ${stats.total}`);
    console.log(`   ✅ С именами: ${stats.with_names}`);
    console.log(`   ⚠️  Без имён: ${stats.without_names}`);

    // 4. Примеры сотрудников
    console.log('\n4️⃣ Примеры сотрудников (последние 10)...');
    const examples = await sql`
      SELECT 
        rentprog_id,
        name,
        data->>'source_field' as source,
        created_at
      FROM employees
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    if (examples.length > 0) {
      console.log('');
      examples.forEach(emp => {
        const createdAt = new Date(emp.created_at).toLocaleString('ru-RU');
        console.log(`   • ID: ${emp.rentprog_id} | ${emp.name || 'Unknown'}`);
        console.log(`     Источник: ${emp.source || 'N/A'} | Создан: ${createdAt}`);
      });
    } else {
      console.log('   ℹ️  Нет сотрудников в БД');
      console.log('   💡 Запустите: node setup/collect_historical_employees.mjs');
    }

    // 5. Проверка external_refs
    console.log('\n5️⃣ Проверка external_refs...');
    const refsCount = await sql`
      SELECT COUNT(*) as count 
      FROM external_refs 
      WHERE entity_type = 'employee'
    `.then(rows => rows[0].count);
    
    console.log(`   📊 Записей в external_refs: ${refsCount}`);
    
    if (stats.total !== parseInt(refsCount)) {
      console.log(`   ⚠️  Несоответствие: employees (${stats.total}) != external_refs (${refsCount})`);
    } else {
      console.log('   ✅ Соответствие: все сотрудники имеют external_refs');
    }

    // 6. Тестовое создание сотрудника
    console.log('\n6️⃣ Тест: создание тестовой брони с сотрудником...');
    
    // Создаем тестовую бронь с новым сотрудником
    const testEmployeeId = '99999';
    const testEmployeeName = 'Test Employee';
    
    const testBooking = await sql`
      INSERT INTO bookings (rentprog_id, data)
      VALUES (
        'test-booking-' || floor(random() * 10000)::text,
        jsonb_build_object(
          'id', 'test-' || floor(random() * 10000)::int,
          'responsible_id', ${testEmployeeId},
          'responsible', ${testEmployeeName}
        )
      )
      RETURNING id
    `.then(rows => rows[0]);
    
    console.log(`   ✅ Тестовая бронь создана: ${testBooking.id}`);
    
    // Проверяем, создался ли сотрудник
    await new Promise(resolve => setTimeout(resolve, 100)); // Даем время триггеру
    
    const testEmployee = await sql`
      SELECT * FROM employees WHERE rentprog_id = ${testEmployeeId}
    `.then(rows => rows[0]);
    
    if (testEmployee) {
      console.log(`   ✅ Сотрудник автоматически создан:`);
      console.log(`      ID: ${testEmployee.rentprog_id}`);
      console.log(`      Имя: ${testEmployee.name}`);
      
      // Удаляем тестовые данные
      await sql`DELETE FROM bookings WHERE id = ${testBooking.id}`;
      await sql`DELETE FROM employees WHERE rentprog_id = ${testEmployeeId}`;
      await sql`DELETE FROM external_refs WHERE external_id = ${testEmployeeId}`;
      console.log('   🧹 Тестовые данные удалены');
    } else {
      console.log('   ❌ Сотрудник НЕ создался автоматически');
      console.log('   💡 Проверьте триггер');
    }

    console.log('\n✅ Проверка завершена!');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

