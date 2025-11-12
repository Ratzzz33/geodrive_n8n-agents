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
      device_id: number;
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
      const mapping = deviceMappings.find(m => m.device_id === device.device_id);

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
    const deviceIdsFromStarline = new Set(devices.map(d => d.device_id));
    const missingDevices = deviceMappings.filter(m => !deviceIdsFromStarline.has(m.device_id));
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
   * Обновить GPS данные для всех сопоставленных машин
   */
  async updateGPSData(): Promise<{ updated: number; errors: string[]; details: any[] }> {
    console.log('📍 Начинаем обновление GPS данных...');

    const sqlConnection = getSqlConnection();
    const matches = await this.matchCars();
    const errors: string[] = [];
    const details: any[] = [];
    let updated = 0;
    let firstDeviceProcessed = false;

    for (const match of matches) {
      let gpsUpdate: GPSUpdate | undefined;
      try {
        // Получаем детальные данные устройства через scraper
        const scraper = getStarlineScraper();
        
        // Для первого устройства добавляем таймаут и отслеживание зависания
        if (!firstDeviceProcessed) {
          firstDeviceProcessed = true;
          console.log(`🔄 Обработка первого устройства: ${match.starlineAlias} (${match.starlineDeviceId})...`);
          
          try {
            const deviceDetails = await Promise.race([
              scraper.getDeviceDetails(match.starlineDeviceId),
              new Promise((_, reject) => 
                setTimeout(() => {
                  reject(new Error(`Timeout: Первое устройство ${match.starlineAlias} не ответило за 15 секунд - возможно, повис сервер страницы`));
                }, 15000)
              )
            ]) as any;
            
            // Если первый запрос успешен - продолжаем обычную обработку
            await this.processDevice(match, deviceDetails, sqlConnection, details, errors);
            updated++;
            console.log(`✅ ${match.starlineAlias}: успешно обработано`);
            continue;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Ошибка на первом устройстве: ${errorMessage}`);
            
            // Отправляем уведомление о зависании
            await this.sendPageHangAlert(match, errorMessage, scraper);
            
            // Добавляем ошибку и продолжаем обработку остальных устройств
            errors.push(`Первый запрос завис: ${errorMessage}`);
            continue;
          }
        }
        
        // Для остальных устройств - обычная обработка
        // Перехватываем ошибки истечения сессии для автоматического перезапуска браузера
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
            console.log(`🔄 Сессия истекла для ${match.starlineAlias}, перезапускаем браузер...`);
            // Перезапуск браузера происходит внутри scraper.getDeviceDetails()
            // Просто повторяем запрос
            deviceDetails = await scraper.getDeviceDetails(match.starlineDeviceId);
          } else {
            throw error;
          }
        }
        await this.processDevice(match, deviceDetails, sqlConnection, details, errors);
        updated++;

      } catch (error) {
        const errorMsg = `Ошибка обновления ${match.starlineAlias}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        console.error(`❌ Детали ошибки:`, error);
        try {
          console.error(`❌ GPSUpdate данные:`, JSON.stringify(gpsUpdate, null, 2));
        } catch (e) {
          console.error(`❌ Не удалось сериализовать gpsUpdate`);
        }
        errors.push(errorMsg);
      }
    }

    console.log(`\n📊 Итого обновлено: ${updated} из ${matches.length}`);
    if (errors.length > 0) {
      console.log(`⚠️ Ошибок: ${errors.length}`);
    }

    return { updated, errors, details };
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

    // Определяем статус
    const status = getCarStatus(deviceDetails);
    const speed = pos.speed ?? 0;
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

