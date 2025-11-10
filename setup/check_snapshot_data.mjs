import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkSnapshot() {
  try {
    console.log('🔍 Проверка данных в snapshot и БД\n');

    // Проверяем машины с пустыми plate в snapshot
    const emptyPlate = await sql`
      SELECT 
        s.rentprog_id,
        s.plate as snapshot_plate,
        s.state as snapshot_state,
        s.model,
        c.plate as db_plate,
        c.state as db_state,
        s.fetched_at
      FROM rentprog_car_states_snapshot s
      LEFT JOIN external_refs er ON er.external_id = s.rentprog_id::text
        AND er.system = 'rentprog'
        AND er.entity_type = 'car'
      LEFT JOIN cars c ON c.id = er.entity_id
      WHERE s.plate IS NULL OR s.plate = ''
      ORDER BY s.fetched_at DESC
      LIMIT 10
    `;

    console.log('📋 Машины с пустым plate в snapshot:');
    if (emptyPlate.length > 0) {
      for (const car of emptyPlate) {
        console.log(`\n   RentProg ID: ${car.rentprog_id}`);
        console.log(`   Модель: ${car.model}`);
        console.log(`   Snapshot plate: ${car.snapshot_plate || 'NULL'}`);
        console.log(`   DB plate: ${car.db_plate || 'NULL'}`);
        console.log(`   Snapshot state: ${car.snapshot_state || 'NULL'}`);
        console.log(`   DB state: ${car.db_state || 'NULL'}`);
        console.log(`   Получено: ${car.fetched_at}`);
      }
    } else {
      console.log('   ✅ Нет машин с пустым plate');
    }

    // Проверяем расхождения между snapshot и БД
    const discrepancies = await sql`
      SELECT 
        s.rentprog_id,
        s.plate as snapshot_plate,
        c.plate as db_plate,
        s.state as snapshot_state,
        c.state as db_state,
        s.model,
        s.company_id as snapshot_company,
        c.company_id as db_company
      FROM rentprog_car_states_snapshot s
      LEFT JOIN external_refs er ON er.external_id = s.rentprog_id::text
        AND er.system = 'rentprog'
        AND er.entity_type = 'car'
      LEFT JOIN cars c ON c.id = er.entity_id
      WHERE 
        (s.plate IS DISTINCT FROM c.plate)
        OR (s.state IS DISTINCT FROM c.state)
        OR (s.company_id::text IS DISTINCT FROM c.company_id::text)
      ORDER BY s.fetched_at DESC
      LIMIT 20
    `;

    console.log('\n📋 Расхождения между snapshot и БД:');
    if (discrepancies.length > 0) {
      console.log(`   Найдено расхождений: ${discrepancies.length}`);
      for (const d of discrepancies.slice(0, 5)) {
        console.log(`\n   RentProg ID: ${d.rentprog_id}`);
        console.log(`   Модель: ${d.model}`);
        console.log(`   Plate: snapshot="${d.snapshot_plate || 'NULL'}" vs DB="${d.db_plate || 'NULL'}"`);
        console.log(`   State: snapshot="${d.snapshot_state || 'NULL'}" vs DB="${d.db_state || 'NULL'}"`);
        console.log(`   Company: snapshot="${d.snapshot_company || 'NULL'}" vs DB="${d.db_company || 'NULL'}"`);
      }
    } else {
      console.log('   ✅ Расхождений не найдено');
    }

    // Статистика по snapshot
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN plate IS NULL OR plate = '' THEN 1 END) as empty_plate,
        COUNT(CASE WHEN state IS NULL OR state = '' THEN 1 END) as empty_state,
        COUNT(CASE WHEN plate IS NOT NULL AND plate != '' THEN 1 END) as has_plate,
        COUNT(CASE WHEN state IS NOT NULL AND state != '' THEN 1 END) as has_state
      FROM rentprog_car_states_snapshot
    `;

    console.log('\n📊 Статистика snapshot:');
    if (stats.length > 0) {
      const s = stats[0];
      console.log(`   Всего машин: ${s.total}`);
      console.log(`   С plate: ${s.has_plate}`);
      console.log(`   Без plate (NULL/пусто): ${s.empty_plate}`);
      console.log(`   С state: ${s.has_state}`);
      console.log(`   Без state (NULL/пусто): ${s.empty_state}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkSnapshot();

