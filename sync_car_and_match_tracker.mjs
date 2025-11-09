import postgres from 'postgres';
import { config } from 'dotenv';

config();

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const RENTPROG_BASE_URL = 'https://rentprog.net/api/v1/public';
const BRANCHES = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
const RENTPROG_TOKENS = {
  tbilisi: process.env.RENTPROG_TBILISI_TOKEN,
  batumi: process.env.RENTPROG_BATUMI_TOKEN,
  kutaisi: process.env.RENTPROG_KUTAISI_TOKEN,
  'service-center': process.env.RENTPROG_SERVICE_CENTER_TOKEN,
};

async function getRequestToken(branch) {
  const companyToken = RENTPROG_TOKENS[branch];
  if (!companyToken) {
    throw new Error(`No token for branch ${branch}`);
  }

  const response = await fetch(`${RENTPROG_BASE_URL}/request_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_token: companyToken })
  });

  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

async function fetchCarFromRentProg(branch, carId) {
  try {
    const token = await getRequestToken(branch);
    
    // Пробуем через /all_cars_full
    const response = await fetch(`${RENTPROG_BASE_URL}/all_cars_full?id=${carId}&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const cars = await response.json();
      if (cars && cars.length > 0) {
        return cars[0];
      }
    }

    // Fallback: прямой endpoint
    const directResponse = await fetch(`${RENTPROG_BASE_URL}/car/${carId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (directResponse.ok) {
      return await directResponse.json();
    }

    return null;
  } catch (error) {
    console.error(`Error fetching car from ${branch}:`, error.message);
    return null;
  }
}

async function syncCarAndMatch() {
  try {
    const rentprogId = '63947';
    const trackerDeviceId = 864326067039309;

    console.log(`🔍 Синхронизация машины из RentProg (ID: ${rentprogId})...\n`);

    // Пробуем получить машину из всех филиалов
    let carData = null;
    let foundBranch = null;

    for (const branch of BRANCHES) {
      console.log(`   Проверяю филиал: ${branch}...`);
      carData = await fetchCarFromRentProg(branch, rentprogId);
      if (carData) {
        foundBranch = branch;
        console.log(`   ✅ Машина найдена в филиале: ${branch}`);
        break;
      }
    }

    if (!carData) {
      console.log('❌ Машина не найдена ни в одном филиале');
      return;
    }

    console.log(`\n📋 Данные машины из RentProg:`);
    console.log(`   ID: ${carData.id}`);
    console.log(`   Название: ${carData.car_name || carData.name || 'не указано'}`);
    console.log(`   Номер: ${carData.number || carData.plate || 'не указан'}`);
    console.log(`   Модель: ${carData.model || 'не указана'}`);
    console.log(`   Филиал: ${foundBranch}`);
    console.log('');

    // Вызываем Jarvis API для синхронизации
    console.log('💾 Синхронизация через Jarvis API...\n');
    
    const jarvisResponse = await fetch('http://46.224.17.15:3000/process-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch: foundBranch,
        type: 'car.update',
        ext_id: rentprogId,
        payload: carData
      })
    });

    if (!jarvisResponse.ok) {
      const errorText = await jarvisResponse.text();
      console.error(`❌ Ошибка синхронизации: ${jarvisResponse.status} - ${errorText}`);
      return;
    }

    const syncResult = await jarvisResponse.json();
    console.log(`✅ Синхронизация завершена:`);
    console.log(`   Car ID: ${syncResult.entityId}`);
    console.log(`   Создана: ${syncResult.created ? 'да' : 'нет'}`);
    console.log('');

    // Ждем немного для завершения транзакции
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Ищем машину в БД
    const car = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name,
        c.model,
        c.branch_id
      FROM cars c
      INNER JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car'
        AND er.system = 'rentprog'
        AND er.external_id = ${rentprogId}
      LIMIT 1
    `;

    if (car.length === 0) {
      console.log('❌ Машина не найдена в БД после синхронизации');
      return;
    }

    const targetCar = car[0];
    console.log(`✅ Машина найдена в БД:`);
    console.log(`   ID: ${targetCar.id}`);
    console.log(`   Название: ${targetCar.car_visual_name || ''} ${targetCar.model}`);
    console.log(`   Номер: ${targetCar.plate}`);
    console.log('');

    // Ищем трекер
    const tracker = await sql`
      SELECT 
        id,
        device_id,
        alias,
        matched,
        car_id
      FROM starline_devices
      WHERE device_id = ${trackerDeviceId}
         OR alias = 'Jeep Renegade RR635WR'
      LIMIT 1
    `;

    if (tracker.length === 0) {
      console.log('❌ Трекер не найден');
      return;
    }

    const trackerData = tracker[0];
    console.log(`📡 Трекер:`);
    console.log(`   Alias: ${trackerData.alias}`);
    console.log(`   Device ID: ${trackerData.device_id}`);
    console.log('');

    // Сопоставляем
    if (trackerData.matched && trackerData.car_id === targetCar.id) {
      console.log('✅ Трекер уже сопоставлен с этой машиной!');
      return;
    }

    console.log('💾 Сопоставляем трекер с машиной...\n');

    await sql`
      UPDATE starline_devices
      SET 
        car_id = ${targetCar.id},
        matched = TRUE,
        match_confidence = 1.00,
        match_method = 'manual_rentprog_sync',
        match_notes = 'Сопоставлено после синхронизации из RentProg ID ' || ${rentprogId} || ', номер: ' || ${targetCar.plate}
      WHERE id = ${trackerData.id}
    `;

    // Записываем в историю
    await sql`
      INSERT INTO starline_match_history (
        starline_device_id,
        car_id,
        matched,
        confidence,
        method,
        starline_alias,
        starline_digits,
        starline_model,
        car_license_plate,
        car_brand,
        car_model,
        reason,
        created_by
      ) VALUES (
        ${trackerData.id},
        ${targetCar.id},
        TRUE,
        1.00,
        'manual_rentprog_sync',
        ${trackerData.alias},
        '635',
        'Jeep Renegade',
        ${targetCar.plate},
        ${targetCar.car_visual_name || ''},
        ${targetCar.model},
        'Сопоставлено после синхронизации из RentProg ID ' || ${rentprogId},
        'manual'
      )
    `;

    console.log('✅ Сопоставление успешно выполнено!');
    console.log(`   ${trackerData.alias} → ${targetCar.car_visual_name || ''} ${targetCar.model} (${targetCar.plate})`);
    console.log(`   RentProg ID: ${rentprogId}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
syncCarAndMatch();

