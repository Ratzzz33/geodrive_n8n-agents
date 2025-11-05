#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Проверка данных о сотрудниках в бронях\n');
  console.log('='.repeat(60));

  try {
    // Проверяем есть ли вообще поля с сотрудниками
    console.log('\n1️⃣ Проверка наличия полей с сотрудниками...');
    
    const fields = ['responsible_id', 'responsible', 'start_worker_id', 'end_worker_id', 'updater', 'state_updater', 'user_id'];
    
    for (const field of fields) {
      const count = await sql`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE data->>${ field } IS NOT NULL
          AND data->>${ field } != 'null'
          AND data->>${ field } != ''
      `.then(rows => parseInt(rows[0].count));
      
      console.log(`   - ${field}: ${count} записей`);
    }

    // Проверяем примеры данных
    console.log('\n2️⃣ Примеры данных с сотрудниками...');
    
    const examples = await sql`
      SELECT 
        id,
        data->>'responsible_id' as responsible_id,
        data->>'responsible' as responsible,
        data->>'start_worker_id' as start_worker_id,
        data->>'end_worker_id' as end_worker_id,
        data->>'updater' as updater
      FROM bookings
      WHERE 
        data->>'responsible_id' IS NOT NULL OR
        data->>'start_worker_id' IS NOT NULL OR
        data->>'end_worker_id' IS NOT NULL
      LIMIT 5
    `;
    
    console.log('');
    examples.forEach((ex, idx) => {
      console.log(`   Пример ${idx + 1}:`);
      console.log(`      ID брони: ${ex.id}`);
      console.log(`      responsible_id: ${ex.responsible_id}`);
      console.log(`      responsible: ${ex.responsible}`);
      console.log(`      start_worker_id: ${ex.start_worker_id}`);
      console.log(`      end_worker_id: ${ex.end_worker_id}`);
      console.log(`      updater: ${ex.updater}`);
      console.log('');
    });

    // Проверяем типы данных
    console.log('\n3️⃣ Проверка типов данных (массивы vs простые значения)...');
    
    const arrayCheck = await sql`
      SELECT 
        id,
        jsonb_typeof(data->'responsible_id') as responsible_id_type,
        data->'responsible_id' as responsible_id_value
      FROM bookings
      WHERE data->'responsible_id' IS NOT NULL
      LIMIT 5
    `;
    
    console.log('');
    arrayCheck.forEach((check, idx) => {
      console.log(`   Пример ${idx + 1}:`);
      console.log(`      Тип: ${check.responsible_id_type}`);
      console.log(`      Значение: ${JSON.stringify(check.responsible_id_value)}`);
      console.log('');
    });

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

