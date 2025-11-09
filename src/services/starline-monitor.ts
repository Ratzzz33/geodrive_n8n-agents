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
    const match = licensePlate.match(/\d{3}/);
    return match ? match[0] : null;
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
   * По названию модели и последним 3 цифрам номера
   */
  async matchCars(): Promise<CarMatch[]> {
    console.log('🔍 Сопоставление машин Starline с таблицей cars...');

    // Получаем все устройства из Starline через persistent scraper
    const scraper = getStarlineScraper();
    const devices = await scraper.getDevices();
    console.log(`📡 Получено ${devices.length} устройств из Starline`);

    // Получаем все машины из нашей БД
    const sqlConnection = getSqlConnection();
    const cars = await sqlConnection`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name as brand,
        c.model
      FROM cars c
      WHERE c.plate IS NOT NULL
    ` as Array<{
      id: string;
      plate: string;
      brand: string;
      model: string;
    }>;

    console.log(`🚗 Найдено ${cars.length} машин в БД`);

    const matches: CarMatch[] = [];

    // Сопоставляем каждое устройство с машиной
    for (const device of devices) {
      if (!device.alias) continue;

      const { model: starlineModel, digits: starlineDigits } = this.extractModelFromAlias(device.alias);
      
      if (!starlineDigits) {
        console.log(`⚠️ Не удалось извлечь 3 цифры из "${device.alias}"`);
        continue;
      }

      // Ищем совпадение в таблице cars
      const matchedCar = cars.find(car => {
        const carDigits = this.extractLast3Digits(car.plate);
        if (!carDigits || carDigits !== starlineDigits) return false;

        // Проверяем совпадение модели (частичное)
        const carModel = `${car.brand} ${car.model}`.toLowerCase();
        const starlineModelLower = starlineModel.toLowerCase();

        return carModel.includes(starlineModelLower) || starlineModelLower.includes(carModel);
      });

      if (matchedCar) {
        matches.push({
          carId: matchedCar.id,
          plate: matchedCar.plate,
          brand: matchedCar.brand,
          model: matchedCar.model,
          starlineDeviceId: device.device_id,
          starlineAlias: device.alias
        });
        console.log(`✅ Сопоставлено: ${device.alias} -> ${matchedCar.brand} ${matchedCar.model} (${matchedCar.plate})`);
      } else {
        console.log(`❌ Не найдено совпадение для: ${device.alias} (${starlineDigits})`);
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

    for (const match of matches) {
      try {
        // Получаем детальные данные устройства через scraper
        const scraper = getStarlineScraper();
        const deviceDetails = await scraper.getDeviceDetails(match.starlineDeviceId);
        
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
          continue;
        }

        const currentLat = pos.y;
        const currentLng = pos.x;
        const currentSatQty = pos.sat_qty;
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
          // Считаем движением если проехали больше 10 метров
          isMoving = distanceMoved > 10;
        }

        // Определяем статус
        const status = getCarStatus(deviceDetails);

        // Извлекаем скорость из Starline (уже в км/ч)
        const speed = pos.speed || 0;

        // Генерируем Google Maps ссылку
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
          speed, // Скорость от Starline в км/ч
          googleMapsLink, // Ссылка на Google Maps
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
            last_sync
          ) VALUES (
            ${gpsUpdate.carId},
            ${gpsUpdate.starlineDeviceId},
            ${gpsUpdate.starlineAlias},
            ${gpsUpdate.currentLat},
            ${gpsUpdate.currentLng},
            ${gpsUpdate.currentSatQty},
            ${gpsUpdate.currentTimestamp.toISOString()},
            ${gpsUpdate.previousLat},
            ${gpsUpdate.previousLng},
            ${gpsUpdate.previousSatQty},
            ${gpsUpdate.previousTimestamp ? gpsUpdate.previousTimestamp.toISOString() : null},
            ${gpsUpdate.status},
            ${gpsUpdate.isMoving},
            ${gpsUpdate.distanceMoved},
            ${gpsUpdate.speed},
            ${gpsUpdate.googleMapsLink},
            ${gpsUpdate.gpsLevel},
            ${gpsUpdate.gsmLevel},
            ${gpsUpdate.ignitionOn},
            ${gpsUpdate.engineRunning},
            ${gpsUpdate.parkingBrake},
            ${gpsUpdate.batteryVoltage},
            ${gpsUpdate.lastActivity.toISOString()},
            NOW()
          )
          ON CONFLICT (car_id) DO UPDATE SET
            starline_device_id = EXCLUDED.starline_device_id,
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

        updated++;
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

      } catch (error) {
        const errorMsg = `Ошибка обновления ${match.starlineAlias}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`\n📊 Итого обновлено: ${updated} из ${matches.length}`);
    if (errors.length > 0) {
      console.log(`⚠️ Ошибок: ${errors.length}`);
    }

    return { updated, errors, details };
  }
}

export default StarlineMonitorService;

