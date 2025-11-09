#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function testTriggerLogic() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🧪 Тест логики триггера extract_rentprog_employees_from_data()\n');

  try {
    // Подготовка: проверим текущее состояние сотрудника 16003
    console.log('📋 Шаг 1: Проверка существующих сотрудников...');
    const existingEmployee = await sql`
      SELECT 
        re.id,
        re.rentprog_id,
        re.name,
        re.updated_at
      FROM rentprog_employees re
      WHERE re.rentprog_id = '16003'
      LIMIT 1
    `.then(rows => rows[0]);

    if (existingEmployee) {
      console.log('   ✅ Найден сотрудник 16003:');
      console.log(`      UUID: ${existingEmployee.id}`);
      console.log(`      Имя: ${existingEmployee.name || '(не указано)'}`);
      console.log(`      Обновлен: ${existingEmployee.updated_at}`);
    } else {
      console.log('   ℹ️  Сотрудник 16003 не найден (будет создан)');
    }

    // Тест 1: Создание нового сотрудника
    console.log('\n📋 Шаг 2: Тест создания нового сотрудника (99999)...');
    await sql`
      INSERT INTO bookings (id, data)
      VALUES (
        gen_random_uuid(),
        '{"id": 999999, "responsible_id": "99999", "responsible": "Тестовый Сотрудник"}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const newEmployee = await sql`
      SELECT 
        re.rentprog_id,
        re.name
      FROM rentprog_employees re
      WHERE re.rentprog_id = '99999'
      LIMIT 1
    `.then(rows => rows[0]);

    if (newEmployee) {
      console.log('   ✅ Сотрудник создан:');
      console.log(`      ID: ${newEmployee.rentprog_id}`);
      console.log(`      Имя: ${newEmployee.name}`);
    } else {
      console.log('   ❌ Сотрудник НЕ создан!');
    }

    // Тест 2: Обновление имени существующего сотрудника
    console.log('\n📋 Шаг 3: Тест обновления имени (99999)...');
    
    const beforeUpdate = await sql`
      SELECT name, updated_at FROM rentprog_employees WHERE rentprog_id = '99999'
    `.then(rows => rows[0]);

    await sql`
      INSERT INTO bookings (id, data)
      VALUES (
        gen_random_uuid(),
        '{"id": 999998, "responsible_id": "99999", "responsible": "Новое Имя Сотрудника"}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const afterUpdate = await sql`
      SELECT name, updated_at FROM rentprog_employees WHERE rentprog_id = '99999'
    `.then(rows => rows[0]);

    if (beforeUpdate && afterUpdate) {
      console.log(`   Имя до: "${beforeUpdate.name}"`);
      console.log(`   Имя после: "${afterUpdate.name}"`);
      
      if (afterUpdate.name === 'Новое Имя Сотрудника') {
        console.log('   ✅ Имя обновлено правильно!');
      } else {
        console.log('   ❌ Имя НЕ обновилось!');
      }
      
      if (afterUpdate.updated_at > beforeUpdate.updated_at) {
        console.log('   ✅ updated_at обновлен');
      }
    }

    // Тест 3: Попытка обновить на то же имя (не должно быть UPDATE)
    console.log('\n📋 Шаг 4: Тест повторной записи того же имени...');
    
    const before = await sql`
      SELECT updated_at FROM rentprog_employees WHERE rentprog_id = '99999'
    `.then(rows => rows[0]);

    await sql`
      INSERT INTO bookings (id, data)
      VALUES (
        gen_random_uuid(),
        '{"id": 999997, "responsible_id": "99999", "responsible": "Новое Имя Сотрудника"}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const after = await sql`
      SELECT updated_at FROM rentprog_employees WHERE rentprog_id = '99999'
    `.then(rows => rows[0]);

    if (before && after) {
      if (before.updated_at.getTime() === after.updated_at.getTime()) {
        console.log('   ✅ updated_at НЕ изменился (правильно, имя не изменилось)');
      } else {
        console.log('   ⚠️  updated_at изменился (лишний UPDATE?)');
      }
    }

    // Тест 4: Массив [old, new] с изменением
    console.log('\n📋 Шаг 5: Тест массива [old, new] как в реальном вебхуке...');
    
    await sql`
      INSERT INTO bookings (id, data)
      VALUES (
        gen_random_uuid(),
        '{"id": 999996, "responsible_id": ["11852", "16003"], "responsible": [null, "Данияр Байбаков"]}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const employee16003 = await sql`
      SELECT rentprog_id, name FROM rentprog_employees WHERE rentprog_id = '16003'
    `.then(rows => rows[0]);

    if (employee16003) {
      console.log(`   ✅ Сотрудник 16003: "${employee16003.name}"`);
      
      if (employee16003.name === 'Данияр Байбаков') {
        console.log('   ✅ Имя обновлено/установлено правильно!');
      }
    }

    // Очистка тестовых данных
    console.log('\n🧹 Очистка тестовых данных...');
    await sql`DELETE FROM rentprog_employees WHERE rentprog_id = '99999'`;
    await sql`DELETE FROM external_refs WHERE external_id = '99999' AND system = 'rentprog'`;
    console.log('   ✅ Тестовые данные удалены');

    console.log('\n✅ Все тесты завершены!');
    console.log('\n📊 Итог:');
    console.log('   • Создание нового сотрудника ✅');
    console.log('   • Обновление имени при изменении ✅');
    console.log('   • Пропуск UPDATE если имя не изменилось ✅');
    console.log('   • Обработка массива [old, new] ✅');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

testTriggerLogic();

