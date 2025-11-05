import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection string для Neon PostgreSQL
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Маппинг филиалов
const BRANCH_MAP = {
  'tbilisi': 'tbilisi',
  'batumi': 'batumi',
  'kutaisi': 'kutaisi',
  'service-center': 'service-center'
};

// Определяем филиал по данным авто
function detectBranch(car) {
  const pts = (car.pts || '').toLowerCase();
  if (pts.includes('tbilisi') || pts.includes('თბილისი')) return 'tbilisi';
  if (pts.includes('batumi') || pts.includes('ბათუმი')) return 'batumi';
  if (pts.includes('kutaisi') || pts.includes('ქუთაისი')) return 'kutaisi';
  return 'tbilisi'; // default
}

async function importCars(jsonFilePath, branchOverride = null) {
  console.log(`\n🚀 Импорт автомобилей из ${jsonFilePath}`);
  
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Подключено к БД');

    // Читаем JSON
    const jsonPath = path.resolve(__dirname, '..', jsonFilePath);
    const jsonContent = await fs.readFile(jsonPath, 'utf8');
    const cars = JSON.parse(jsonContent);

    console.log(`📄 Загружено ${cars.length} автомобилей`);

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const car of cars) {
      try {
        const branch = branchOverride || detectBranch(car);
        const rentprogId = String(car.id);
        const plateRaw = car.number || car.car_number || null;
        if (plateRaw && /^([A-Za-z]{2}-\d{3}-[A-Za-z]{2})$/.test(plateRaw)) {
          console.warn(`⏭️  Пропуск авто ${rentprogId}: фейковый номер ${plateRaw}`);
          continue;
        }
        
        // Получаем branch_id
        const branchResult = await client.query(
          'SELECT id FROM branches WHERE code = $1 LIMIT 1',
          [branch]
        );
        
        if (branchResult.rows.length === 0) {
          console.warn(`⚠️ Филиал ${branch} не найден для авто ${rentprogId}`);
          continue;
        }
        
        const branchId = branchResult.rows[0].id;
        
        // Проверяем, существует ли авто
        const existingCar = await client.query(`
          SELECT id FROM cars WHERE data->>'id' = $1 LIMIT 1
        `, [rentprogId]);
        
        let carId;
        let isNew = false;
        
        if (existingCar.rows.length > 0) {
          // Обновляем существующее
          carId = existingCar.rows[0].id;
          await client.query(`
            UPDATE cars SET
              branch_id = $1,
              plate = $2,
              vin = $3,
              model = $4,
              starline_id = $5,
              data = $6::jsonb,
              rentprog_id = $7,
              updated_at = NOW()
            WHERE id = $8
          `, [
            branchId,
            plateRaw,
            car.vin || null,
            car.car_name || null,
            car.starline_id || null,
            JSON.stringify(car),
            rentprogId,
            carId
          ]);
        } else {
          // Создаем новое
          const result = await client.query(`
            INSERT INTO cars (
              id, branch_id, plate, vin, model, starline_id, data, rentprog_id, created_at, updated_at
            )
            VALUES (
              gen_random_uuid(),
              $1,
              $2,
              $3,
              $4,
              $5,
              $6::jsonb,
              $7,
              NOW(),
              NOW()
            )
            RETURNING id
          `, [
            branchId,
            plateRaw,
            car.vin || null,
            car.car_name || null,
            car.starline_id || null,
            JSON.stringify(car),
            rentprogId
          ]);
          carId = result.rows[0].id;
          isNew = true;
        }
        
        if (isNew) {
          imported++;
        } else {
          updated++;
        }
        
        // Upsert в external_refs
        await client.query(`
          INSERT INTO external_refs (
            id, entity_type, entity_id, system, external_id, branch_code, meta, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(),
            'car',
            $1,
            'rentprog',
            $2,
            $3,
            $4::jsonb,
            NOW(),
            NOW()
          )
          ON CONFLICT (system, external_id) DO UPDATE SET
            entity_id = EXCLUDED.entity_id,
            branch_code = EXCLUDED.branch_code,
            meta = EXCLUDED.meta,
            updated_at = NOW()
        `, [
          carId,
          rentprogId,
          branch,
          JSON.stringify({ branch, synced_at: new Date().toISOString() })
        ]);
        
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
    if (errors > 0) {
      console.log(`❌ Ошибок: ${errors}`);
    }
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Запуск
const jsonFile = process.argv[2] || 'temp/batumi_cars.json';
const branch = process.argv[3] || null;

importCars(jsonFile, branch).catch(console.error);

