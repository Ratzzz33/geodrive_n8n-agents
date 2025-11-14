/**
 * Starline Monitor Service
 * Сопоставляет машины из Starline с нашей таблицей cars
 * и обновляет GPS данные
 */

import { getStarlineScraper } from './starline-scraper.js';
import { getDatabase, getSqlConnection } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { getCarStatus, calculateDistance } from '../utils/starline-helpers.js';
import { sendTelegramAlert } from '../integrations/n8n.js';
import { config } from '../config/index.js';

interface CarMatch {
  carId: string;
  plate: string;
  brand: string;
  model: string;
  starlineDeviceId: number;
  starlineAlias: string;
}

interface GPSUpdate {
  carId: string;
  starlineDeviceId: number;
  starlineAlias: string;
  currentLat: number;
  currentLng: number;
  currentSatQty: number;
  currentTimestamp: Date;
  previousLat: number | null;
  previousLng: number | null;
  previousSatQty: number | null;
  previousTimestamp: Date | null;
  status: string;
  isMoving: boolean;
  distanceMoved: number;
  speed: number; // Скорость в км/ч от Starline
  googleMapsLink: string; // Ссылка на Google Maps
  gpsLevel: number;
  gsmLevel: number;
  ignitionOn: boolean;
  engineRunning: boolean;
  parkingBrake: boolean;
  batteryVoltage: number | null;
  lastActivity: Date;
}

export class StarlineMonitorService {
  constructor() {
    // Используем singleton scraper, который уже инициализирован
  }

  /**
   * Сгенерировать ссылку на Google Maps по координатам
   */
  private generateGoogleMapsLink(lat: number, lng: number): string {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  /**
   * Извлечь последние 3 цифры из номера
   * Примеры: "XX950DX" -> "950", "WW080UU" -> "080"
   */
  private extractLast3Digits(licensePlate: string): string | null {
    // Ищем 3 цифры в номерной части (обычно формат: XX123XX)
    // Приоритет: 3 цифры окруженные буквами (номерная часть)
    const plateMatch = licensePlate.match(/[A-Z]{2,3}(\d{3})[A-Z]{2}/i);
    if (plateMatch) return plateMatch[1];
    
    // Fallback: ищем последнюю группу из 3+ цифр и берем первые 3
    const allDigitGroups = licensePlate.match(/\d+/g);
    if (!allDigitGroups) return null;
    
    const lastGroup = allDigitGroups[allDigitGroups.length - 1];
    return lastGroup.length >= 3 ? lastGroup.slice(0, 3) : null;
  }

  /**
   * Извлечь название модели из алиаса Starline
   * Примеры: "BMW 3 587" -> "BMW 3", "Audi Q7 White XX950DX" -> "Audi Q7"
   */
  private extractModelFromAlias(alias: string): { model: string; digits: string | null } {
    // Убираем последние 3 цифры и всё после них
    const cleanAlias = alias.replace(/\s+\d{3}.*$/, '').trim();
    
    // Извлекаем 3 цифры
    const digitsMatch = alias.match(/\d{3}/);
    const digits = digitsMatch ? digitsMatch[0] : null;
    
    return {
      model: cleanAlias,
      digits
    };
  }

  /**
   * Сопоставить машины из Starline с таблицей cars
   * Использует таблицу starline_devices по device_id (центральное место сопоставления)
   * Alias может меняться и не используется для сопоставления
   */
  async matchCars(): Promise<CarMatch[]> {
    console.log('🔍 Сопоставление машин Starline с таблицей cars через starline_devices...');

    // Получаем все устройства из Starline через persistent scraper (для актуальных данных)
    const scraper = getStarlineScraper();
    const devices = await scraper.getDevices();
    console.log(`📡 Получено ${devices.length} устройств из Starline`);

    // Получаем сопоставления из starline_devices по device_id (центральное место)
    const sqlConnection = getSqlConnection();
    const deviceMappings = await sqlConnection`
      SELECT 
        sd.device_id,
        sd.alias,
        sd.car_id,
        sd.matched,
        c.plate,
        c.car_visual_name as brand,
        c.model
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE
        AND sd.active = TRUE
    ` as Array<{
      device_id: number | string; // Может быть bigint (строка) из PostgreSQL
      alias: string;
      car_id: string;
      matched: boolean;
      plate: string;
      brand: string | null;
      model: string;
    }>;

    console.log(`🔗 Найдено ${deviceMappings.length} сопоставленных устройств в starline_devices`);

    const matches: CarMatch[] = [];

    // Сопоставляем каждое устройство из Starline с сопоставлениями из БД по device_id
    for (const device of devices) {
      // Ищем устройство в starline_devices по device_id (не по alias!)
      // Приводим к числу для корректного сравнения (PostgreSQL bigint может быть строкой)
      const mapping = deviceMappings.find(m => Number(m.device_id) === Number(device.device_id));

      if (mapping && mapping.matched && mapping.car_id) {
        matches.push({
          carId: mapping.car_id,
          plate: mapping.plate,
          brand: mapping.brand || '',
          model: mapping.model,
          starlineDeviceId: device.device_id, // Используем device_id (неизменяемый)
          starlineAlias: device.alias // Только для отображения (может меняться)
        });
        console.log(`✅ Сопоставлено по device_id: ${device.device_id} (${device.alias}) -> ${mapping.brand || ''} ${mapping.model} (${mapping.plate})`);
      } else {
        console.log(`⚠️ Устройство ${device.device_id} (${device.alias}) не сопоставлено в starline_devices`);
      }
    }

    // Проверяем, какие устройства из starline_devices не найдены в списке от Starline
    // Приводим к числу для корректного сравнения
    const deviceIdsFromStarline = new Set(devices.map(d => Number(d.device_id)));
    const missingDevices = deviceMappings.filter(m => !deviceIdsFromStarline.has(Number(m.device_id)));
    if (missingDevices.length > 0) {
      console.log(`⚠️ ВНИМАНИЕ: ${missingDevices.length} устройств из starline_devices не найдены в списке от Starline:`);
      for (const missing of missingDevices) {
        console.log(`   - Device ID: ${missing.device_id}, Alias: ${missing.alias}, Plate: ${missing.plate}`);
      }
    }

    console.log(`✅ Всего сопоставлено: ${matches.length} из ${devices.length}`);
    return matches;
  }

  /**
   * Безопасная обработка одного устройства (обертка для параллельной обработки)
   */
  private async processDeviceSafe(
    match: CarMatch,
    sqlConnection: any
  ): Promise<{ success: boolean; detail?: any; error?: string }> {
    try {
      const scraper = getStarlineScraper();
      let deviceDetails;
      
      try {
        deviceDetails = await scraper.getDeviceDetails(match.starlineDeviceId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Если ошибка связана с истечением сессии - перезапускаем браузер и повторяем
        if (errorMessage.includes('page.evaluate') && 
            (errorMessage.includes('Unexpected token') || 
             errorMessage.includes('Необходима') || 
             /[А-Яа-яЁё]/.test(errorMessage))) {
          logger.warn(`StarlineMonitorService: Session expired for ${match.starlineAlias}, retrying...`);
          // Перезапуск браузера происходит внутри scraper.getDeviceDetails()
          deviceDetails = await scraper.getDeviceDetails(match.starlineDeviceId);
        } else {
          throw error;
        }
      }
      
      const detailsArray: any[] = [];
      await this.processDevice(match, deviceDetails, sqlConnection, detailsArray, []);
      
      // Возвращаем первый (и единственный) элемент из массива
      return { success: true, detail: detailsArray[0] };
    } catch (error) {
      const errorMsg = `Ошибка обновления ${match.starlineAlias}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(`StarlineMonitorService: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Обновить GPS данные для всех сопоставленных машин
   */
  async updateGPSData(): Promise<{ updated: number; errors: string[]; details: any[] }> {
    const startTime = Date.now();
    const batchSize = config.starlineParallelBatchSize;
    const isParallel = batchSize > 1;
    
    logger.info(`📍 Начинаем обновление GPS данных (режим: ${isParallel ? `параллельный, батч ${batchSize}` : 'последовательный'})...`);

    const sqlConnection = getSqlConnection();
    const matches = await this.matchCars();
    const errors: string[] = [];
    const details: any[] = [];
    let updated = 0;
    let firstDeviceProcessed = false;

    // Обработка первого устройства отдельно (для проверки зависания)
    if (matches.length > 0) {
      const firstMatch = matches[0];
      firstDeviceProcessed = true;
      logger.info(`🔄 Обработка первого устройства: ${firstMatch.starlineAlias} (${firstMatch.starlineDeviceId})...`);
      
      try {
        const deviceDetails = await Promise.race([
          getStarlineScraper().getDeviceDetails(firstMatch.starlineDeviceId),
          new Promise((_, reject) => 
            setTimeout(() => {
              reject(new Error(`Timeout: Первое устройство ${firstMatch.starlineAlias} не ответило за 15 секунд`));
            }, 15000)
          )
        ]) as any;
        
        await this.processDevice(firstMatch, deviceDetails, sqlConnection, details, errors);
        updated++;
        logger.info(`✅ ${firstMatch.starlineAlias}: успешно обработано`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`❌ Ошибка на первом устройстве: ${errorMessage}`);
        errors.push(`Первый запрос завис: ${errorMessage}`);
      }
    }

    // Обработка остальных устройств
    const remainingMatches = matches.slice(1);
    
    if (isParallel && remainingMatches.length > 0) {
      // Параллельная обработка батчами
      logger.info(`🔄 Параллельная обработка ${remainingMatches.length} устройств батчами по ${batchSize}...`);
      
      const batches: CarMatch[][] = [];
      for (let i = 0; i < remainingMatches.length; i += batchSize) {
        batches.push(remainingMatches.slice(i, i + batchSize));
      }
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();
        
        logger.info(`📦 Батч ${batchIndex + 1}/${batches.length}: обработка ${batch.length} устройств...`);
        
        const results = await Promise.allSettled(
          batch.map(match => this.processDeviceSafe(match, sqlConnection))
        );
        
        results.forEach((result, index) => {
          const match = batch[index];
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              updated++;
              if (result.value.detail) {
                details.push(result.value.detail);
              }
            } else {
              errors.push(result.value.error || `Ошибка обработки ${match.starlineAlias}`);
            }
          } else {
            errors.push(`Ошибка обработки ${match.starlineAlias}: ${result.reason}`);
          }
        });
        
        const batchDuration = Date.now() - batchStartTime;
        logger.info(`✅ Батч ${batchIndex + 1}/${batches.length} завершен за ${batchDuration}ms (${(batchDuration / batch.length).toFixed(0)}ms на устройство)`);
      }
    } else {
      // Последовательная обработка (старый способ, для обратной совместимости)
      logger.info(`🔄 Последовательная обработка ${remainingMatches.length} устройств...`);
      
      for (const match of remainingMatches) {
        const result = await this.processDeviceSafe(match, sqlConnection);
        if (result.success) {
          updated++;
          if (result.detail) {
            details.push(result.detail);
          }
        } else {
          errors.push(result.error || `Ошибка обработки ${match.starlineAlias}`);
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    const avgTimePerDevice = matches.length > 0 ? (totalDuration / matches.length).toFixed(0) : 0;
    const successRate = matches.length > 0 ? ((updated / matches.length) * 100).toFixed(2) : 0;
    
    logger.info(`\n📊 Итого обновлено: ${updated} из ${matches.length} за ${(totalDuration / 1000).toFixed(1)}с (${avgTimePerDevice}ms на устройство, успешность: ${successRate}%)`);
    if (errors.length > 0) {
      logger.warn(`⚠️ Ошибок: ${errors.length}`);
    }

    // Сохраняем метрики в БД
    try {
      await this.saveMetrics({
        totalDevices: matches.length,
        processedDevices: updated,
        failedDevices: errors.length,
        totalDurationMs: totalDuration,
        avgDeviceDurationMs: parseFloat(avgTimePerDevice || '0'),
        batchSize: config.starlineParallelBatchSize,
        parallelMode: config.starlineParallelBatchSize > 1,
        successRate: parseFloat(successRate || '0')
      });
    } catch (metricsError) {
      logger.error(`StarlineMonitorService: Failed to save metrics:`, metricsError);
    }

    return { updated, errors, details };
  }

  /**
   * Сохранение метрик производительности в БД
   */
  private async saveMetrics(metrics: {
    totalDevices: number;
    processedDevices: number;
    failedDevices: number;
    totalDurationMs: number;
    avgDeviceDurationMs: number;
    batchSize: number;
    parallelMode: boolean;
    successRate: number;
    browserRestarts?: number;
    sessionExpiredCount?: number;
    proxyUsed?: boolean;
  }): Promise<void> {
    const sqlConnection = getSqlConnection();
    
    await sqlConnection`
      INSERT INTO starline_metrics (
        total_devices, processed_devices, failed_devices,
        total_duration_ms, avg_device_duration_ms,
        batch_size, parallel_mode, success_rate,
        browser_restarts, session_expired_count, proxy_used
      ) VALUES (
        ${metrics.totalDevices}, ${metrics.processedDevices}, ${metrics.failedDevices},
        ${metrics.totalDurationMs}, ${metrics.avgDeviceDurationMs},
        ${metrics.batchSize}, ${metrics.parallelMode}, ${metrics.successRate},
        ${metrics.browserRestarts || 0}, ${metrics.sessionExpiredCount || 0}, ${metrics.proxyUsed || false}
      )
    `;
  }

  /**
   * Обработка одного устройства (вынесено для переиспользования)
   */
  private async processDevice(
    match: CarMatch,
    deviceDetails: any,
    sqlConnection: any,
    details: any[],
    errors: string[]
  ): Promise<void> {
    // Получаем текущие координаты из БД (чтобы сохранить как previous)
    const existingResult = await sqlConnection`
      SELECT 
        current_lat,
        current_lng,
        current_sat_qty,
        current_timestamp
      FROM gps_tracking
      WHERE car_id = ${match.carId}
    `;

    const existing = existingResult[0] as {
      current_lat: string | null;
      current_lng: string | null;
      current_sat_qty: number | null;
      current_timestamp: Date | null;
    } | undefined;

    // Новые координаты
    const pos = deviceDetails.pos || deviceDetails.position;
    if (!pos) {
      console.log(`⚠️ Нет координат для ${match.starlineAlias}`);
      return;
    }

    const currentLat = pos.y;
    const currentLng = pos.x;
    const currentSatQty = pos.sat_qty ?? 0;
    const currentTimestamp = new Date(pos.ts * 1000);

    // Предыдущие координаты (из БД)
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

    // ОТЛАДКА: Логируем статус для Maserati
    if (match.starlineAlias?.includes('Maserati') || match.starlineAlias?.includes('686')) {
      console.log('========== MASERATI STATUS DEBUG ==========');
      console.log('Device:', match.starlineAlias);
      console.log('deviceDetails.status:', deviceDetails.status, '(0=offline, 1=online)');
      console.log('deviceDetails.gps_lvl:', deviceDetails.gps_lvl);
      console.log('deviceDetails.pos?.sat_qty:', deviceDetails.pos?.sat_qty);
      console.log('deviceDetails.car_state?.ign:', deviceDetails.car_state?.ign);
      console.log('deviceDetails.car_state?.run:', deviceDetails.car_state?.run);
      console.log('==========================================');
    }
    
    // Определяем статус
    const status = getCarStatus(deviceDetails);
    
    // ВАЖНО: поле скорости в Starline API называется "s", а не "speed"!
    const speed = pos.s ?? 0;
    const googleMapsLink = this.generateGoogleMapsLink(currentLat, currentLng);

    // Подготавливаем данные для обновления
    const gpsUpdate: GPSUpdate = {
      carId: match.carId,
      starlineDeviceId: match.starlineDeviceId,
      starlineAlias: match.starlineAlias,
      currentLat,
      currentLng,
      currentSatQty,
      currentTimestamp,
      previousLat,
      previousLng,
      previousSatQty,
      previousTimestamp,
      status,
      isMoving,
      distanceMoved,
      speed,
      googleMapsLink,
      gpsLevel: deviceDetails.gps_lvl ?? 0,
      gsmLevel: deviceDetails.gsm_lvl ?? 0,
      ignitionOn: deviceDetails.car_state?.ign ?? false,
      engineRunning: deviceDetails.car_state?.run ?? false,
      parkingBrake: deviceDetails.car_state?.pbrake ?? false,
      batteryVoltage: deviceDetails.battery ?? null,
      lastActivity: deviceDetails.ts_activity ? new Date(deviceDetails.ts_activity * 1000) : new Date()
    };

    // Upsert в БД
    await sqlConnection`
      INSERT INTO gps_tracking (
        car_id, starline_device_id, starline_alias,
        current_lat, current_lng, current_sat_qty, "current_timestamp",
        previous_lat, previous_lng, previous_sat_qty, "previous_timestamp",
        status, is_moving, distance_moved, speed, google_maps_link,
        gps_level, gsm_level, ignition_on, engine_running, parking_brake,
        battery_voltage, last_activity, last_sync
      ) VALUES (
        ${gpsUpdate.carId}, ${gpsUpdate.starlineDeviceId}, ${gpsUpdate.starlineAlias},
        ${gpsUpdate.currentLat}, ${gpsUpdate.currentLng}, ${gpsUpdate.currentSatQty}, ${gpsUpdate.currentTimestamp.toISOString()},
        ${gpsUpdate.previousLat}, ${gpsUpdate.previousLng}, ${gpsUpdate.previousSatQty}, ${gpsUpdate.previousTimestamp ? gpsUpdate.previousTimestamp.toISOString() : null},
        ${gpsUpdate.status}, ${gpsUpdate.isMoving}, ${gpsUpdate.distanceMoved}, ${gpsUpdate.speed}, ${gpsUpdate.googleMapsLink},
        ${gpsUpdate.gpsLevel}, ${gpsUpdate.gsmLevel}, ${gpsUpdate.ignitionOn}, ${gpsUpdate.engineRunning}, ${gpsUpdate.parkingBrake},
        ${gpsUpdate.batteryVoltage}, ${gpsUpdate.lastActivity.toISOString()}, NOW()
      )
      ON CONFLICT (starline_device_id) DO UPDATE SET
        car_id = EXCLUDED.car_id,
        starline_alias = EXCLUDED.starline_alias,
        current_lat = EXCLUDED.current_lat,
        current_lng = EXCLUDED.current_lng,
        current_sat_qty = EXCLUDED.current_sat_qty,
        "current_timestamp" = EXCLUDED."current_timestamp",
        previous_lat = EXCLUDED.previous_lat,
        previous_lng = EXCLUDED.previous_lng,
        previous_sat_qty = EXCLUDED.previous_sat_qty,
        "previous_timestamp" = EXCLUDED."previous_timestamp",
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
        last_sync = NOW()
    `;

    // Сохраняем историю вольтажа (если вольтаж есть)
    if (gpsUpdate.batteryVoltage !== null && gpsUpdate.batteryVoltage !== undefined) {
      await sqlConnection`
        INSERT INTO battery_voltage_history (
          car_id, starline_device_id, battery_voltage, timestamp,
          ignition_on, engine_running, status
        ) VALUES (
          ${gpsUpdate.carId}, ${gpsUpdate.starlineDeviceId}, ${gpsUpdate.batteryVoltage}, ${gpsUpdate.currentTimestamp.toISOString()},
          ${gpsUpdate.ignitionOn}, ${gpsUpdate.engineRunning}, ${gpsUpdate.status}
        )
      `;

      // Проверяем на нестандартное падение вольтажа
      await this.checkBatteryVoltageAnomaly(
        match,
        gpsUpdate.batteryVoltage,
        gpsUpdate.ignitionOn,
        gpsUpdate.engineRunning,
        sqlConnection
      );
    }

    // Сохраняем историю скорости при каждом проходе (даже если скорость = 0)
    if (gpsUpdate.speed !== null && gpsUpdate.speed !== undefined) {
      await sqlConnection`
        INSERT INTO speed_history (
          car_id, starline_device_id, speed, timestamp,
          latitude, longitude, ignition_on, engine_running, status, is_moving
        ) VALUES (
          ${gpsUpdate.carId}, ${gpsUpdate.starlineDeviceId}, ${gpsUpdate.speed}, ${gpsUpdate.currentTimestamp.toISOString()},
          ${gpsUpdate.currentLat}, ${gpsUpdate.currentLng}, ${gpsUpdate.ignitionOn}, ${gpsUpdate.engineRunning}, ${gpsUpdate.status}, ${gpsUpdate.isMoving}
        )
      `;

      // Проверяем на превышение скорости (125 км/ч)
      if (gpsUpdate.speed > 125) {
        await this.checkSpeedViolation(
          match,
          gpsUpdate.speed,
          gpsUpdate.currentLat,
          gpsUpdate.currentLng,
          gpsUpdate.googleMapsLink,
          sqlConnection
        );
      }
    }

    details.push({
      plate: match.plate,
      brand: match.brand,
      model: match.model,
      alias: match.starlineAlias,
      status,
      isMoving,
      speed: Math.round(speed),
      distanceMoved: Math.round(distanceMoved),
      lat: currentLat,
      lng: currentLng,
      googleMapsLink,
      ignitionOn: gpsUpdate.ignitionOn,
      engineRunning: gpsUpdate.engineRunning,
      batteryVoltage: gpsUpdate.batteryVoltage,
      satQty: currentSatQty,
      gpsLevel: gpsUpdate.gpsLevel,
      gsmLevel: gpsUpdate.gsmLevel
    });
    console.log(`✅ ${match.starlineAlias}: ${status} ${isMoving ? '🚗 (движется)' : '🅿️ (стоит)'} ${speed.toFixed(0)} км/ч, ${distanceMoved.toFixed(0)}m`);

    // Запись в timeline (только если координаты изменились или машина движется)
    if (isMoving || (previousLat !== null && previousLng !== null && distanceMoved > 0)) {
      try {
        const { addGPSToTimeline } = await import('../db/entityTimeline.js');
        
        const [carData] = await sqlConnection`
          SELECT b.code as branch_code
          FROM cars c
          LEFT JOIN branches b ON b.id = c.branch_id
          WHERE c.id = ${match.carId}
          LIMIT 1
        `;
        
        const branchCode = carData?.branch_code || undefined;
        
        await addGPSToTimeline(match.carId, {
          lat: currentLat,
          lng: currentLng,
          isMoving,
          distance: distanceMoved,
          speed,
          branchCode,
        });
      } catch (timelineError) {
        console.warn(`Failed to add GPS to timeline for ${match.starlineAlias}:`, timelineError);
      }
    }
  }

  /**
   * Проверка на нестандартное падение вольтажа
   * Сравнивает текущий вольтаж с средним по всем авто за последние 24 часа
   */
  private async checkBatteryVoltageAnomaly(
    match: CarMatch,
    currentVoltage: number,
    ignitionOn: boolean,
    engineRunning: boolean,
    sqlConnection: any
  ): Promise<void> {
    try {
      // Пропускаем проверку если зажигание включено или двигатель работает
      // (вольтаж может быть выше из-за генератора)
      if (ignitionOn || engineRunning) {
        return;
      }

      // Получаем средний вольтаж по всем авто за последние 24 часа
      // Только для авто с выключенным зажиганием (для корректного сравнения)
      const avgVoltageResult = await sqlConnection`
        SELECT 
          AVG(battery_voltage) as avg_voltage,
          COUNT(*) as sample_count,
          STDDEV(battery_voltage) as stddev_voltage
        FROM battery_voltage_history
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
          AND ignition_on = FALSE
          AND engine_running = FALSE
          AND battery_voltage IS NOT NULL
          AND battery_voltage > 0
      `;

      const avgVoltage = avgVoltageResult[0]?.avg_voltage;
      const sampleCount = avgVoltageResult[0]?.sample_count || 0;
      const stddevVoltage = avgVoltageResult[0]?.stddev_voltage || 0;

      // Нужно минимум 10 измерений для статистики
      if (!avgVoltage || sampleCount < 10) {
        return;
      }

      // Вычисляем отклонение от среднего
      const deviation = currentVoltage - Number(avgVoltage);
      const deviationPercent = (deviation / Number(avgVoltage)) * 100;

      // Пороги для уведомления:
      // - Абсолютное отклонение > 0.5V ИЛИ
      // - Относительное отклонение > 10% ИЛИ
      // - Вольтаж ниже среднего на 2 стандартных отклонения (критично)
      const criticalThreshold = Number(avgVoltage) - (2 * Number(stddevVoltage));
      const isCritical = currentVoltage < criticalThreshold;
      const isAnomaly = Math.abs(deviation) > 0.5 || Math.abs(deviationPercent) > 10 || isCritical;

      if (isAnomaly) {
        // Проверяем, не отправляли ли уже уведомление за последний час (чтобы не спамить)
        const recentAlert = await sqlConnection`
          SELECT COUNT(*) as count
          FROM battery_voltage_alerts
          WHERE car_id = ${match.carId}
            AND created_at >= NOW() - INTERVAL '1 hour'
        `;

        if (recentAlert[0]?.count > 0) {
          return; // Уже отправляли уведомление недавно
        }

        // Формируем сообщение
        const severity = isCritical ? '🔴 КРИТИЧНО' : '⚠️ ВНИМАНИЕ';
        const message = `${severity} **Нестандартное падение вольтажа**

🚗 **Машина:** ${match.brand} ${match.model} (${match.plate})
📱 **Устройство:** ${match.starlineAlias}

📊 **Текущий вольтаж:** ${currentVoltage.toFixed(2)}V
📈 **Средний по парку:** ${Number(avgVoltage).toFixed(2)}V
📉 **Отклонение:** ${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}V (${deviationPercent > 0 ? '+' : ''}${deviationPercent.toFixed(1)}%)
${isCritical ? `🚨 **Критическое отклонение:** ниже среднего на ${((Number(avgVoltage) - currentVoltage) / Number(stddevVoltage)).toFixed(1)} стандартных отклонений` : ''}

📋 **Статистика:**
• Образцов для сравнения: ${sampleCount}
• Стандартное отклонение: ${Number(stddevVoltage).toFixed(2)}V

🕐 **Время:** ${new Date().toISOString()}

💡 **Рекомендация:** Проверить состояние АКБ и генератора`;

        await sendTelegramAlert(message);
        logger.warn(`Battery voltage anomaly detected for ${match.plate}: ${currentVoltage}V (avg: ${Number(avgVoltage).toFixed(2)}V, deviation: ${deviation.toFixed(2)}V)`);

        // Сохраняем запись об уведомлении (если таблица существует)
        try {
          await sqlConnection`
            INSERT INTO battery_voltage_alerts (
              car_id, starline_device_id, battery_voltage, avg_voltage,
              deviation, deviation_percent, is_critical, created_at
            ) VALUES (
              ${match.carId}, ${match.starlineDeviceId}, ${currentVoltage}, ${Number(avgVoltage)},
              ${deviation}, ${deviationPercent}, ${isCritical}, NOW()
            )
          `;
        } catch (alertTableError) {
          // Таблица может не существовать, это не критично
          logger.debug('battery_voltage_alerts table does not exist, skipping alert log');
        }
      }
    } catch (error) {
      logger.error(`Failed to check battery voltage anomaly for ${match.plate}:`, error);
    }
  }

  /**
   * Проверка на превышение скорости (125 км/ч)
   * Отправляет уведомление в Telegram при превышении
   */
  private async checkSpeedViolation(
    match: CarMatch,
    currentSpeed: number,
    latitude: number | null,
    longitude: number | null,
    googleMapsLink: string,
    sqlConnection: any
  ): Promise<void> {
    try {
      // Проверяем, не отправляли ли уже уведомление за последние 10 минут (чтобы не спамить)
      const recentAlert = await sqlConnection`
        SELECT COUNT(*) as count
        FROM speed_violations
        WHERE car_id = ${match.carId}
          AND created_at >= NOW() - INTERVAL '10 minutes'
      `;

      if (recentAlert[0]?.count > 0) {
        return; // Уже отправляли уведомление недавно
      }

      // Формируем сообщение
      const locationInfo = latitude && longitude 
        ? `📍 **Местоположение:** ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n🗺️ **Карта:** ${googleMapsLink}`
        : '📍 **Местоположение:** Недоступно';

      const message = `🚨 **Превышение скорости**

🚗 **Машина:** ${match.brand} ${match.model} (${match.plate})
📱 **Устройство:** ${match.starlineAlias}

⚡ **Скорость:** ${currentSpeed.toFixed(0)} км/ч
🚫 **Лимит:** 125 км/ч
📊 **Превышение:** ${(currentSpeed - 125).toFixed(0)} км/ч

${locationInfo}

🕐 **Время:** ${new Date().toISOString()}

⚠️ **Требуется:** Проверить обстоятельства превышения скорости`;

      await sendTelegramAlert(message);
      logger.warn(`Speed violation detected for ${match.plate}: ${currentSpeed.toFixed(0)} km/h (limit: 125 km/h)`);

      // Сохраняем запись о нарушении (если таблица существует)
      try {
        await sqlConnection`
          INSERT INTO speed_violations (
            car_id, starline_device_id, speed, speed_limit,
            latitude, longitude, google_maps_link, created_at
          ) VALUES (
            ${match.carId}, ${match.starlineDeviceId}, ${currentSpeed}, 125,
            ${latitude}, ${longitude}, ${googleMapsLink}, NOW()
          )
        `;
      } catch (violationTableError) {
        // Таблица может не существовать, это не критично
        logger.debug('speed_violations table does not exist, skipping violation log');
      }
    } catch (error) {
      logger.error(`Failed to check speed violation for ${match.plate}:`, error);
    }
  }

  /**
   * Отправка уведомления о зависании страницы
   */
  private async sendPageHangAlert(
    match: CarMatch,
    errorMessage: string,
    scraper: any
  ): Promise<void> {
    try {
      // Получаем диагностику состояния браузера
      let diagnosis = null;
      try {
        diagnosis = await scraper.diagnose();
      } catch (diagError) {
        logger.warn('Failed to get diagnosis:', diagError);
      }

      // Формируем сообщение
      const diagnosisInfo = diagnosis ? `
📊 **Диагностика:**
• Браузер подключен: ${diagnosis.browserConnected ? '✅' : '❌'}
• Страница существует: ${diagnosis.pageExists ? '✅' : '❌'}
• URL: ${diagnosis.currentUrl || 'N/A'}
• На домене Starline: ${diagnosis.isOnStarlineDomain ? '✅' : '❌'}
• JS выполняется: ${diagnosis.canExecuteJS ? '✅' : '❌'}
• Fetch тест: ${diagnosis.fetchTest.success ? '✅' : '❌'} ${diagnosis.fetchTest.error ? `(${diagnosis.fetchTest.error})` : ''}
• Статус логина: ${diagnosis.loginStatus}
` : '';

      const message = `🔴 **Starline GPS Monitor - Повис сервер страницы**

❌ **Проблема:** Запрос завис на первом устройстве
📱 **Устройство:** ${match.starlineAlias} (ID: ${match.starlineDeviceId})
🚗 **Машина:** ${match.brand} ${match.model} (${match.plate})

**Ошибка:**
\`\`\`
${errorMessage}
\`\`\`
${diagnosisInfo}
🕐 **Время:** ${new Date().toISOString()}

💡 **Действия:**
• Проверить состояние браузера
• Возможно, требуется перезапуск API
• Проверить доступность Starline`;

      await sendTelegramAlert(message);
      logger.warn('Page hang alert sent to Telegram');
    } catch (alertError) {
      logger.error('Failed to send page hang alert:', alertError);
    }
  }
}

export default StarlineMonitorService;

