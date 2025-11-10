import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
  try {
    console.log('📊 АНАЛИЗ ПОСЛЕДНЕГО ВЫПОЛНЕНИЯ WORKFLOW\n');
    console.log('━'.repeat(60));

    // 1. Проверяем snapshot - почему там NULL для plate и state
    console.log('\n1. ПРОБЛЕМА: В snapshot NULL для plate и state\n');
    
    const snapshotStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN plate IS NULL OR plate = '' THEN 1 END) as empty_plate,
        COUNT(CASE WHEN state IS NULL OR state = '' THEN 1 END) as empty_state,
        MAX(fetched_at) as last_fetch
      FROM rentprog_car_states_snapshot
    `;

    if (snapshotStats.length > 0) {
      const s = snapshotStats[0];
      console.log(`   Всего машин в snapshot: ${s.total}`);
      console.log(`   Без plate (NULL/пусто): ${s.empty_plate}`);
      console.log(`   Без state (NULL/пусто): ${s.empty_state}`);
      console.log(`   Последнее обновление: ${s.last_fetch}`);
    }

    // 2. Проверяем расхождения
    console.log('\n2. РАСХОЖДЕНИЯ: snapshot vs БД\n');
    
    const discrepancies = await sql`
      SELECT 
        s.rentprog_id,
        s.plate as s_plate,
        c.plate as c_plate,
        s.state as s_state,
        c.state as c_state,
        s.model,
        s.company_id::text as s_company,
        c.company_id::text as c_company
      FROM rentprog_car_states_snapshot s
      LEFT JOIN external_refs er ON er.external_id = s.rentprog_id::text
        AND er.system = 'rentprog'
        AND er.entity_type = 'car'
      LEFT JOIN cars c ON c.id = er.entity_id
      WHERE 
        (NULLIF(TRIM(s.plate::text), '') IS DISTINCT FROM NULLIF(TRIM(c.plate::text), ''))
        OR (NULLIF(TRIM(s.state::text), '') IS DISTINCT FROM NULLIF(TRIM(c.state::text), ''))
        OR (s.company_id::text IS DISTINCT FROM c.company_id::text)
      ORDER BY s.fetched_at DESC
      LIMIT 10
    `;

    console.log(`   Найдено расхождений: ${discrepancies.length}`);
    for (const d of discrepancies.slice(0, 5)) {
      console.log(`\n   RentProg ID: ${d.rentprog_id}`);
      console.log(`   Модель: ${d.model}`);
      console.log(`   Plate: snapshot="${d.s_plate || 'NULL'}" vs DB="${d.c_plate || 'NULL'}"`);
      console.log(`   State: snapshot="${d.s_state || 'NULL'}" vs DB="${d.c_state || 'NULL'}"`);
      console.log(`   Company: snapshot="${d.s_company || 'NULL'}" vs DB="${d.c_company || 'NULL'}"`);
    }

    // 3. Проверяем конкретные машины из ошибки
    console.log('\n3. МАШИНЫ ИЗ ОШИБКИ (engine_power = "null")\n');
    
    const errorCars = ['54914', '54612', '52138', '63338', '68353'];
    for (const carId of errorCars) {
      const car = await sql`
        SELECT 
          s.rentprog_id,
          s.engine_power as s_power,
          c.engine_power as c_power,
          s.engine_capacity as s_capacity,
          c.engine_capacity as c_capacity,
          s.model,
          c.plate
        FROM rentprog_car_states_snapshot s
        LEFT JOIN external_refs er ON er.external_id = s.rentprog_id::text
          AND er.system = 'rentprog'
          AND er.entity_type = 'car'
        LEFT JOIN cars c ON c.id = er.entity_id
        WHERE s.rentprog_id = ${carId}
      `;
      
      if (car.length > 0) {
        const c = car[0];
        console.log(`\n   RentProg ID: ${c.rentprog_id}`);
        console.log(`   Модель: ${c.model}, Plate: ${c.plate || 'NULL'}`);
        console.log(`   Engine Power: snapshot="${c.s_power || 'NULL'}" (type: ${typeof c.s_power}) vs DB="${c.c_power || 'NULL'}" (type: ${typeof c.c_power})`);
        console.log(`   Engine Capacity: snapshot="${c.s_capacity || 'NULL'}" vs DB="${c.c_capacity || 'NULL'}"`);
      }
    }

    // 4. Проверяем, почему в snapshot сохраняются NULL
    console.log('\n4. ПРИЧИНА: Почему в snapshot NULL?\n');
    console.log('   Проблема в узле "Upsert Snapshot":');
    console.log('   - Используется {{ $json.number }} для plate');
    console.log('   - Используется {{ $json.state }} для state');
    console.log('   - Если в API эти поля пустые/отсутствуют → сохраняется NULL');
    console.log('   - Но в БД эти поля есть (восстановлены через скрипт)');
    console.log('   - SQL сравнивает NULL (snapshot) vs значение (БД) → расхождение');

    // 5. Проверяем ошибку в Apply Updates
    console.log('\n5. ОШИБКА: "Cannot read properties of undefined (reading \'match\')"\n');
    console.log('   Причина:');
    console.log('   - "Generate SQL Updates" вернул noUpdates: true');
    console.log('   - sqlQuery отсутствует (undefined)');
    console.log('   - "Apply Updates" пытается обработать undefined.sqlQuery.match()');
    console.log('   - Ошибка в Postgres узле при обработке пустого запроса');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

analyze();

