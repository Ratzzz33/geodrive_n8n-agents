import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkSnapshotVsAPI() {
  try {
    console.log('🔍 Проверка: почему в snapshot NULL для plate и state\n');

    // Проверяем несколько машин из snapshot
    const sampleCars = await sql`
      SELECT 
        s.rentprog_id,
        s.plate as snapshot_plate,
        s.state as snapshot_state,
        s.model,
        s.fetched_at,
        c.plate as db_plate,
        c.state as db_state,
        c.updated_at as db_updated
      FROM rentprog_car_states_snapshot s
      LEFT JOIN external_refs er ON er.external_id = s.rentprog_id::text
        AND er.system = 'rentprog'
        AND er.entity_type = 'car'
      LEFT JOIN cars c ON c.id = er.entity_id
      WHERE s.plate IS NULL OR s.state IS NULL
      ORDER BY s.fetched_at DESC
      LIMIT 5
    `;

    console.log('📋 Примеры машин с NULL в snapshot:');
    for (const car of sampleCars) {
      console.log(`\n   RentProg ID: ${car.rentprog_id}`);
      console.log(`   Модель: ${car.model}`);
      console.log(`   Snapshot plate: ${car.snapshot_plate || 'NULL'}`);
      console.log(`   DB plate: ${car.db_plate || 'NULL'}`);
      console.log(`   Snapshot state: ${car.snapshot_state || 'NULL'}`);
      console.log(`   DB state: ${car.db_state || 'NULL'}`);
      console.log(`   Snapshot создан: ${car.fetched_at}`);
      console.log(`   DB обновлена: ${car.db_updated || 'NULL'}`);
    }

    // Проверяем временные метки
    console.log('\n📅 Временные метки:');
    const timestamps = await sql`
      SELECT 
        MAX(fetched_at) as last_snapshot,
        MAX(updated_at) as last_db_update
      FROM rentprog_car_states_snapshot, cars
    `;

    if (timestamps.length > 0) {
      const t = timestamps[0];
      console.log(`   Последний snapshot: ${t.last_snapshot}`);
      console.log(`   Последнее обновление БД: ${t.last_db_update}`);
      
      if (t.last_snapshot && t.last_db_update) {
        const snapshotTime = new Date(t.last_snapshot);
        const dbTime = new Date(t.last_db_update);
        const diff = dbTime - snapshotTime;
        console.log(`   Разница: ${Math.round(diff / 1000 / 60)} минут`);
        
        if (diff > 0) {
          console.log(`   ⚠️  Snapshot старше БД - данные в snapshot устарели!`);
        }
      }
    }

    // Проверяем, почему в snapshot NULL
    console.log('\n🔍 ПРИЧИНА NULL в snapshot:');
    console.log('   В узле "Upsert Snapshot" используется:');
    console.log('   - {{ $json.number }} для plate');
    console.log('   - {{ $json.state }} для state');
    console.log('');
    console.log('   Если в API эти поля:');
    console.log('   - Отсутствуют → n8n подставляет пустую строку или NULL');
    console.log('   - Пустые → сохраняется пустая строка или NULL');
    console.log('   - null → сохраняется NULL');
    console.log('');
    console.log('   ПРОБЛЕМА: В snapshot сохраняются NULL, хотя в БД эти поля есть');
    console.log('   (потому что snapshot был создан ДО восстановления данных)');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkSnapshotVsAPI();

