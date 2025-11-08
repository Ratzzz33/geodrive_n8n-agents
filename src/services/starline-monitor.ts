/**
 * Starline Monitor Service
 * Сопоставляет машины из Starline с нашей таблицей cars
 * и обновляет GPS данные
 */

import { StarlineClient } from '../integrations/starline-client';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';

interface CarMatch {
  carId: string;
  licensePlate: string;
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
  gpsLevel: number;
  gsmLevel: number;
  ignitionOn: boolean;
  engineRunning: boolean;
  parkingBrake: boolean;
  batteryVoltage: number | null;
  lastActivity: Date;
}

export class StarlineMonitorService {
  private client: StarlineClient;

  constructor() {
    this.client = new StarlineClient();
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

    // Получаем все устройства из Starline
    const devices = await this.client.getDevices();
    console.log(`📡 Получено ${devices.length} устройств из Starline`);

    // Получаем все машины из нашей БД
    const carsResult = await db.execute(sql`
      SELECT 
        c.id,
        c.license_plate,
        c.brand,
        c.model,
        c.branch
      FROM cars c
      WHERE c.license_plate IS NOT NULL
    `);

    const cars = carsResult.rows as Array<{
      id: string;
      license_plate: string;
      brand: string;
      model: string;
      branch: string;
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
        const carDigits = this.extractLast3Digits(car.license_plate);
        if (!carDigits || carDigits !== starlineDigits) return false;

        // Проверяем совпадение модели (частичное)
        const carModel = `${car.brand} ${car.model}`.toLowerCase();
        const starlineModelLower = starlineModel.toLowerCase();

        return carModel.includes(starlineModelLower) || starlineModelLower.includes(carModel);
      });

      if (matchedCar) {
        matches.push({
          carId: matchedCar.id,
          licensePlate: matchedCar.license_plate,
          brand: matchedCar.brand,
          model: matchedCar.model,
          starlineDeviceId: device.device_id,
          starlineAlias: device.alias
        });
        console.log(`✅ Сопоставлено: ${device.alias} -> ${matchedCar.brand} ${matchedCar.model} (${matchedCar.license_plate})`);
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
  async updateGPSData(): Promise<{ updated: number; errors: string[] }> {
    console.log('📍 Начинаем обновление GPS данных...');

    const matches = await this.matchCars();
    const errors: string[] = [];
    let updated = 0;

    for (const match of matches) {
      try {
        // Получаем детальные данные устройства
        const deviceDetails = await this.client.getDeviceDetails(match.starlineDeviceId);
        
        // Получаем текущие координаты из БД (чтобы сохранить как previous)
        const existingResult = await db.execute(sql`
          SELECT 
            current_lat,
            current_lng,
            current_sat_qty,
            current_timestamp
          FROM gps_tracking
          WHERE car_id = ${match.carId}
        `);

        const existing = existingResult.rows[0] as {
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
        const previousTimestamp = existing?.current_timestamp || null;

        // Определяем движение
        let isMoving = false;
        let distanceMoved = 0;

        if (previousLat && previousLng) {
          distanceMoved = this.client.calculateDistance(
            { x: previousLng, y: previousLat, sat_qty: previousSatQty || 0, ts: 0 },
            { x: currentLng, y: currentLat, sat_qty: currentSatQty, ts: pos.ts }
          );
          // Считаем движением если проехали больше 10 метров
          isMoving = distanceMoved > 10;
        }

        // Определяем статус
        const status = this.client.getCarStatus(deviceDetails);

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
          gpsLevel: deviceDetails.gps_lvl || 0,
          gsmLevel: deviceDetails.gsm_level || 0,
          ignitionOn: deviceDetails.car_state?.ign || false,
          engineRunning: deviceDetails.car_state?.run || false,
          parkingBrake: deviceDetails.car_state?.pbrake || false,
          batteryVoltage: deviceDetails.battery || null,
          lastActivity: deviceDetails.ts_activity ? new Date(deviceDetails.ts_activity * 1000) : new Date()
        };

        // Upsert в БД
        await db.execute(sql`
          INSERT INTO gps_tracking (
            car_id,
            starline_device_id,
            starline_alias,
            current_lat,
            current_lng,
            current_sat_qty,
            current_timestamp,
            previous_lat,
            previous_lng,
            previous_sat_qty,
            previous_timestamp,
            status,
            is_moving,
            distance_moved,
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
            current_timestamp = EXCLUDED.current_timestamp,
            previous_lat = EXCLUDED.previous_lat,
            previous_lng = EXCLUDED.previous_lng,
            previous_sat_qty = EXCLUDED.previous_sat_qty,
            previous_timestamp = EXCLUDED.previous_timestamp,
            status = EXCLUDED.status,
            is_moving = EXCLUDED.is_moving,
            distance_moved = EXCLUDED.distance_moved,
            gps_level = EXCLUDED.gps_level,
            gsm_level = EXCLUDED.gsm_level,
            ignition_on = EXCLUDED.ignition_on,
            engine_running = EXCLUDED.engine_running,
            parking_brake = EXCLUDED.parking_brake,
            battery_voltage = EXCLUDED.battery_voltage,
            last_activity = EXCLUDED.last_activity,
            last_sync = NOW()
        `);

        updated++;
        console.log(`✅ ${match.starlineAlias}: ${status} ${isMoving ? '🚗 (движется)' : '🅿️ (стоит)'} ${distanceMoved.toFixed(0)}m`);

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

    return { updated, errors };
  }
}

export default StarlineMonitorService;

