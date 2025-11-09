#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function debugTrigger() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Отладка: проверка срабатывания триггера\n');

  try {
    // Проверим, сработает ли триггер при использовании dynamic_upsert_entity
    console.log('📝 Тест 1: Вызов через dynamic_upsert_entity (как в реальном workflow)...');
    
    const testData = {
      id: 888888,
      responsible_id: '88888',
      responsible: 'Тест через Динамик',
      state: 'active'
    };

    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        '888888'::TEXT,
        ${JSON.stringify(testData)}::JSONB
      )
    `.then(rows => rows[0]);

    console.log('   Результат dynamic_upsert_entity:');
    console.log(`   entity_id: ${result.entity_id}`);
    console.log(`   created: ${result.created}`);

    // Проверим, создался ли сотрудник
    const employee = await sql`
      SELECT rentprog_id, name FROM rentprog_employees WHERE rentprog_id = '88888'
    `.then(rows => rows[0]);

    if (employee) {
      console.log(`   ✅ Сотрудник создан: ${employee.name}`);
    } else {
      console.log('   ❌ Сотрудник НЕ создан');
      
      // Проверим, какие триггеры есть на bookings
      console.log('\n   🔍 Проверка триггеров на bookings:');
      const triggers = await sql`
        SELECT tgname, proname, tgenabled
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE c.relname = 'bookings'
          AND NOT t.tgisinternal
      `;
      
      triggers.forEach(t => {
        console.log(`      ${t.tgname} → ${t.proname} (enabled: ${t.tgenabled})`);
      });
    }

    // Тест 2: UPDATE существующей записи
    console.log('\n📝 Тест 2: UPDATE брони с новым responsible_id...');
    
    const testData2 = {
      id: 888888,
      responsible_id: '88889',
      responsible: 'Обновленное Имя',
      state: 'active'
    };

    await sql`
      SELECT * FROM dynamic_upsert_entity(
        'bookings'::TEXT,
        '888888'::TEXT,
        ${JSON.stringify(testData2)}::JSONB
      )
    `;

    const employee2 = await sql`
      SELECT rentprog_id, name FROM rentprog_employees WHERE rentprog_id = '88889'
    `.then(rows => rows[0]);

    if (employee2) {
      console.log(`   ✅ Новый сотрудник создан: ${employee2.name}`);
    } else {
      console.log('   ❌ Новый сотрудник НЕ создан');
    }

    // Очистка
    console.log('\n🧹 Очистка...');
    await sql`DELETE FROM rentprog_employees WHERE rentprog_id IN ('88888', '88889')`;
    await sql`DELETE FROM external_refs WHERE external_id IN ('88888', '88889') AND system = 'rentprog'`;
    await sql`DELETE FROM bookings WHERE id = (SELECT entity_id FROM external_refs WHERE external_id = '888888' AND system = 'rentprog' AND entity_type = 'booking')`;
    console.log('   ✅ Очищено');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

debugTrigger();

