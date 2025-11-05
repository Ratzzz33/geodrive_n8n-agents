import { Client } from 'pg';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// JSON из сообщения пользователя - первые 2 машины для теста
const carsFromUser = JSON.parse(process.argv[2] || '[]');
const branch = process.argv[3] || 'batumi';

async function importCars() {
  console.log(`\n🚀 Импорт ${carsFromUser.length} автомобилей (филиал: ${branch})`);
  
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Подключено к БД');

    const branchResult = await client.query(
      'SELECT id FROM branches WHERE code = $1 LIMIT 1',
      [branch]
    );
    
    if (branchResult.rows.length === 0) {
      throw new Error(`Филиал ${branch} не найден`);
    }
    
    const branchId = branchResult.rows[0].id;
    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const car of carsFromUser) {
      try {
        const rentprogId = String(car.id);
        
        const existingCar = await client.query(`
          SELECT id FROM cars WHERE data->>'id' = $1 LIMIT 1
        `, [rentprogId]);
        
        let carId;
        let isNew = false;
        
        if (existingCar.rows.length > 0) {
          carId = existingCar.rows[0].id;
          await client.query(`
            UPDATE cars SET
              branch_id = $1,
              plate = $2,
              vin = $3,
              model = $4,
              data = $5::jsonb,
              updated_at = NOW()
            WHERE id = $6
          `, [
            branchId,
            car.number || null,
            car.vin || null,
            car.car_name || null,
            JSON.stringify(car),
            carId
          ]);
        } else {
          const result = await client.query(`
            INSERT INTO cars (
              id, branch_id, plate, vin, model, data, created_at, updated_at
            )
            VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, NOW(), NOW()
            )
            RETURNING id
          `, [
            branchId,
            car.number || null,
            car.vin || null,
            car.car_name || null,
            JSON.stringify(car)
          ]);
          carId = result.rows[0].id;
          isNew = true;
        }
        
        if (isNew) imported++;
        else updated++;
        
        await client.query(`
          INSERT INTO external_refs (
            id, entity_type, entity_id, system, external_id, branch_code, meta, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), 'car', $1, 'rentprog', $2, $3, $4::jsonb, NOW(), NOW()
          )
          ON CONFLICT (system, external_id) DO UPDATE SET
            entity_id = EXCLUDED.entity_id,
            branch_code = EXCLUDED.branch_code,
            updated_at = NOW()
        `, [
          carId,
          rentprogId,
          branch,
          JSON.stringify({ branch, synced_at: new Date().toISOString() })
        ]);
        
        if ((imported + updated) % 10 === 0) {
          console.log(`⏳ Обработано: ${imported + updated}/${carsFromUser.length}`);
        }
        
      } catch (err) {
        console.error(`❌ Ошибка при импорте авто ${car.id}:`, err.message);
        errors++;
      }
    }

    console.log('\n========================================');
    console.log('✅ ИМПОРТ ЗАВЕРШЕН');
    console.log('========================================');
    console.log(`➕ Добавлено: ${imported}`);
    console.log(`♻️  Обновлено: ${updated}`);
    if (errors > 0) console.log(`❌ Ошибок: ${errors}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

importCars().catch(console.error);

