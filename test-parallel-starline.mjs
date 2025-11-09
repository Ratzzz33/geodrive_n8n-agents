import { initDatabase, getSqlConnection } from './src/db/index.js';
import { getStarlineScraper } from './src/services/starline-scraper.js';
import { getCarStatus, calculateDistance } from './src/utils/starline-helpers.js';

/**
 * Тестовый скрипт для параллельной обработки Starline устройств
 * Обрабатывает по 20 устройств параллельно
 */

// Batch size - сколько устройств обрабатывать параллельно
const BATCH_SIZE = 20;

/**
 * Обработать batch устройств параллельно
 */
async function processBatch(matches, scraper, sqlConnection) {
  const results = await Promise.all(matches.map(async (match) => {
    try {
      // Получаем детальные данные устройства
      const deviceDetails = await scraper.getDeviceDetails(match.starlineDeviceId);
      
      // Получаем текущие координаты из БД
      const existingResult = await sqlConnection`
        SELECT 
          current_lat,
          current_lng,
          current_sat_qty,
          current_timestamp
        FROM gps_tracking
        WHERE car_id = ${match.carId}
      `;

      const existing = existingResult[0];

      // Новые координаты
      const pos = deviceDetails.pos || deviceDetails.position;
      if (!pos) {
        return { success: false, error: `Нет координат для ${match.starlineAlias}` };
      }

      const currentLat = pos.y;
      const currentLng = pos.x;
      const currentSatQty = pos.sat_qty ?? 0;
      const currentTimestamp = new Date(pos.ts * 1000);

      // Предыдущие координаты
      const previousLat = existing?.current_lat ? parseFloat(existing.current_lat) : null;
      const previousLng = existing?.current_lng ? parseFloat(existing.current_lng) : null;
      const previousSatQty = existing?.current_sat_qty || null;
      const previousTimestamp = existing?.current_timestamp ? new Date(existing.current_timestamp) : null;

      // Определяем движение
      let isMoving = false;
      let distanceMoved = 0;

      if (previousLat && previousLng) {
        distanceMoved = calculateDistance(
          { x: previousLng, y: previousLat, sat_qty: previousSatQty || 0, ts: 0 },
          { x: currentLng, y: currentLat, sat_qty: currentSatQty, ts: pos.ts }
        );
        isMoving = distanceMoved > 10;
      }

      const status = getCarStatus(deviceDetails);
      const speed = pos.speed ?? 0;
      const googleMapsLink = `https://www.google.com/maps?q=${currentLat},${currentLng}`;

      // Upsert в БД
      await sqlConnection`
        INSERT INTO gps_tracking (
          car_id,
          starline_device_id,
          starline_alias,
          current_lat,
          current_lng,
          current_sat_qty,
          "current_timestamp",
          previous_lat,
          previous_lng,
          previous_sat_qty,
          "previous_timestamp",
          status,
          is_moving,
          distance_moved,
          speed,
          google_maps_link,
          gps_level,
          gsm_level,
          ignition_on,
          engine_running,
          parking_brake,
          battery_voltage,
          last_activity,
          updated_at
        ) VALUES (
          ${match.carId},
          ${match.starlineDeviceId},
          ${match.starlineAlias},
          ${currentLat},
          ${currentLng},
          ${currentSatQty},
          ${currentTimestamp},
          ${previousLat},
          ${previousLng},
          ${previousSatQty},
          ${previousTimestamp},
          ${status},
          ${isMoving},
          ${distanceMoved},
          ${speed},
          ${googleMapsLink},
          ${deviceDetails.gps_lvl ?? 0},
          ${deviceDetails.gsm_lvl ?? 0},
          ${deviceDetails.car_state?.ign ?? false},
          ${deviceDetails.car_state?.run ?? false},
          ${deviceDetails.car_state?.pbrake ?? false},
          ${deviceDetails.battery ?? null},
          ${deviceDetails.ts_activity ? new Date(deviceDetails.ts_activity * 1000) : new Date()},
          NOW()
        )
        ON CONFLICT (car_id) DO UPDATE SET
          starline_device_id = EXCLUDED.starline_device_id,
          starline_alias = EXCLUDED.starline_alias,
          previous_lat = gps_tracking.current_lat,
          previous_lng = gps_tracking.current_lng,
          previous_sat_qty = gps_tracking.current_sat_qty,
          "previous_timestamp" = gps_tracking."current_timestamp",
          current_lat = EXCLUDED.current_lat,
          current_lng = EXCLUDED.current_lng,
          current_sat_qty = EXCLUDED.current_sat_qty,
          "current_timestamp" = EXCLUDED."current_timestamp",
          status = EXCLUDED.status,
          is_moving = EXCLUDED.is_moving,
          distance_moved = EXCLUDED.distance_moved,
          speed = EXCLUDED.speed,
          google_maps_link = EXCLUDED.google_maps_link,
          gps_level = EXCLUDED.gps_level,
          gsm_level = EXCLUDED.gsm_level,
          ignition_on = EXCLUDED.ignition_on,
          engine_running = EXCLUDED.engine_running,
          parking_brake = EXCLUDED.parking_brake,
          battery_voltage = EXCLUDED.battery_voltage,
          last_activity = EXCLUDED.last_activity,
          updated_at = NOW()
      `;

      return { success: true, match };
    } catch (error) {
      return { success: false, error: `Ошибка обновления ${match.starlineAlias}: ${error.message}` };
    }
  }));

  return results;
}

/**
 * Основная функция
 */
async function testParallelProcessing() {
  const startTime = Date.now();
  console.log('⏱️ Запуск параллельной обработки...\n');

  // Инициализируем БД
  await initDatabase();
  
  const sqlConnection = getSqlConnection();
  const scraper = getStarlineScraper();

  try {
    // Получаем устройства из Starline
    console.log('📡 Получение устройств из Starline...');
    const devices = await scraper.getDevices();
    console.log(`✅ Получено ${devices.length} устройств\n`);

    // Получаем машины из БД
    console.log('🚗 Получение машин из БД...');
    const cars = await sqlConnection`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name as brand,
        c.model
      FROM cars c
      WHERE c.plate IS NOT NULL
    `;
    console.log(`✅ Найдено ${cars.length} машин\n`);

    // Простое сопоставление (без полной логики для скорости)
    console.log('🔍 Сопоставление устройств с машинами...');
    const matches = [];
    
    for (const device of devices) {
      const digitsMatch = device.alias.match(/\d{3}/);
      if (!digitsMatch) continue;
      
      const starlineDigits = digitsMatch[0];
      const matchedCar = cars.find(car => car.plate.includes(starlineDigits));
      
      if (matchedCar) {
        matches.push({
          carId: matchedCar.id,
          starlineDeviceId: device.device_id,
          starlineAlias: device.alias
        });
      }
    }
    console.log(`✅ Сопоставлено: ${matches.length} устройств\n`);

    // Обработка батчами
    console.log(`🚀 Обработка батчами по ${BATCH_SIZE} устройств параллельно...\n`);
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(matches.length / BATCH_SIZE);
      
      console.log(`📦 Batch ${batchNum}/${totalBatches}: Обработка ${batch.length} устройств...`);
      const batchStart = Date.now();
      
      const results = await processBatch(batch, scraper, sqlConnection);
      
      const batchTime = ((Date.now() - batchStart) / 1000).toFixed(2);
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      updated += successCount;
      errors += errorCount;
      
      console.log(`   ✅ Успешно: ${successCount}, ❌ Ошибок: ${errorCount}, ⏱️ Время: ${batchTime}s\n`);
      
      // Показываем ошибки если есть
      results.filter(r => !r.success).forEach(r => {
        console.log(`   ⚠️ ${r.error}`);
      });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГИ:');
    console.log('='.repeat(60));
    console.log(`✅ Обновлено: ${updated}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`⏱️ Общее время: ${totalTime}s`);
    console.log(`⚡ Скорость: ${(updated / parseFloat(totalTime)).toFixed(2)} машин/сек`);
    console.log(`🎯 Экономия времени: ~${(60 - parseFloat(totalTime)).toFixed(1)}s (было 60s)`);
    console.log('='.repeat(60));

  } finally {
    await sqlConnection.end();
  }
}

testParallelProcessing().catch(console.error);

