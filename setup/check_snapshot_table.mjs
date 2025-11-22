#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkSnapshotTable() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка таблицы rentprog_car_states_snapshot\n');

    // Проверяем существование таблицы
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'rentprog_car_states_snapshot'
      ) AS exists;
    `;

    if (tableExists[0].exists) {
      console.log('✅ Таблица rentprog_car_states_snapshot существует\n');
      
      // Проверяем структуру
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'rentprog_car_states_snapshot'
        ORDER BY ordinal_position;
      `;
      
      console.log('📋 Структура таблицы:');
      columns.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
      
      // Проверяем количество записей
      const count = await sql`
        SELECT COUNT(*) as count FROM rentprog_car_states_snapshot;
      `;
      
      console.log(`\n📊 Записей в таблице: ${count[0].count}`);
      
    } else {
      console.log('❌ Таблица rentprog_car_states_snapshot НЕ СУЩЕСТВУЕТ!\n');
      console.log('💡 Нужно либо:');
      console.log('   1. Создать таблицу rentprog_car_states_snapshot');
      console.log('   2. Или изменить ноду "Save Snapshot" чтобы она сохраняла в другую таблицу\n');
      console.log('🔍 Давайте проверим что существует в БД:');
      
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE '%car%'
        ORDER BY table_name;
      `;
      
      console.log('\n📋 Таблицы связанные с cars:');
      tables.forEach(t => {
        console.log(`   - ${t.table_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkSnapshotTable();

