#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function verifySetup() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка настройки bookings.responsible_id\n');

  try {
    // 1. Проверить таблицу rentprog_employees
    console.log('1️⃣ Проверка таблицы rentprog_employees...');
    const employeesCount = await sql`
      SELECT COUNT(*) as count FROM rentprog_employees
    `.then(rows => rows[0].count);
    console.log(`   ✅ Таблица существует, записей: ${employeesCount}`);

    // 2. Проверить колонку bookings.responsible_id
    console.log('\n2️⃣ Проверка колонки bookings.responsible_id...');
    const col = await sql`
      SELECT 
        c.column_name,
        c.data_type,
        tc.constraint_type,
        ccu.table_name as foreign_table,
        ccu.column_name as foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND tc.constraint_type = 'FOREIGN KEY'
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE c.table_name = 'bookings'
        AND c.column_name = 'responsible_id'
      LIMIT 1
    `.then(rows => rows[0]);

    if (!col) {
      console.log('   ❌ Колонка responsible_id не найдена!');
      return;
    }

    console.log('   ✅ Колонка найдена:');
    console.log(`      Тип: ${col.data_type}`);
    console.log(`      FK → ${col.foreign_table}.${col.foreign_column}`);

    if (col.foreign_table !== 'rentprog_employees') {
      console.log('   ⚠️  ВНИМАНИЕ: FK ссылается не на rentprog_employees!');
    }

    // 3. Проверить триггер
    console.log('\n3️⃣ Проверка триггера...');
    const trigger = await sql`
      SELECT 
        tgname as trigger_name,
        proname as function_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE c.relname = 'bookings'
        AND proname = 'extract_rentprog_employees_from_data'
      LIMIT 1
    `.then(rows => rows[0]);

    if (trigger) {
      console.log('   ✅ Триггер найден:');
      console.log(`      Имя: ${trigger.trigger_name}`);
      console.log(`      Функция: ${trigger.function_name}`);
    } else {
      console.log('   ❌ Триггер extract_rentprog_employees_from_data не найден на bookings!');
    }

    // 4. Проверить текущие данные
    console.log('\n4️⃣ Проверка данных брони 506974...');
    const booking = await sql`
      SELECT 
        b.id,
        b.responsible_id,
        re.rentprog_id as employee_rentprog_id,
        re.name as employee_name,
        er_booking.external_id as booking_rentprog_id
      FROM external_refs er_booking
      JOIN bookings b ON b.id = er_booking.entity_id
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE er_booking.system = 'rentprog' 
        AND er_booking.entity_type = 'booking'
        AND er_booking.external_id = '506974'
      LIMIT 1
    `.then(rows => rows[0]);

    if (booking) {
      console.log('   ✅ Бронь найдена:');
      console.log(`      UUID: ${booking.id}`);
      console.log(`      RentProg ID: ${booking.booking_rentprog_id}`);
      
      if (booking.responsible_id) {
        console.log(`      Ответственный: ${booking.employee_name || '(имя неизвестно)'}`);
        console.log(`      RentProg ID сотрудника: ${booking.employee_rentprog_id || 'N/A'}`);
      } else {
        console.log(`      Ответственный: (не заполнено)`);
        console.log(`      ℹ️  Будет заполнено при следующем вебхуке с responsible_id`);
      }
    } else {
      console.log('   ❌ Бронь 506974 не найдена в БД');
    }

    // 5. Проверить сотрудников
    console.log('\n5️⃣ Проверка сотрудников...');
    const employees = await sql`
      SELECT 
        re.rentprog_id,
        re.name,
        COUNT(b.id) as bookings_count
      FROM rentprog_employees re
      LEFT JOIN bookings b ON b.responsible_id = re.id
      GROUP BY re.id, re.rentprog_id, re.name
      ORDER BY bookings_count DESC, re.rentprog_id
      LIMIT 10
    `;

    if (employees.length > 0) {
      console.log(`   ✅ Найдено сотрудников: ${employees.length}`);
      console.log('\n   Топ сотрудников по бронированиям:');
      employees.forEach(e => {
        console.log(`      ${e.rentprog_id}: ${e.name || '(имя неизвестно)'} - ${e.bookings_count} броней`);
      });
    } else {
      console.log('   ℹ️  Сотрудников пока нет (будут созданы при обработке вебхуков)');
    }

    console.log('\n✅ Проверка завершена!');
    console.log('\n📋 Итог:');
    console.log('   • Таблица rentprog_employees ✅');
    console.log(`   • bookings.responsible_id → ${col.foreign_table} ✅`);
    console.log(`   • Триггер ${trigger ? '✅' : '❌'}`);
    console.log('\n🔄 Следующие шаги:');
    console.log('   1. Дождитесь вебхука от RentProg с responsible_id');
    console.log('   2. Триггер автоматически создаст запись в rentprog_employees');
    console.log('   3. И заполнит bookings.responsible_id');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await sql.end();
  }
}

verifySetup();

