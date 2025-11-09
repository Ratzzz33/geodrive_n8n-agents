/**
 * Starline Devices Sync Service
 * Синхронизирует устройства из Starline в таблицу starline_devices
 * и выполняет автоматическое сопоставление с cars
 */

import { getStarlineScraper } from './starline-scraper';
import { getDatabase, getSqlConnection } from '../db/index';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

interface DeviceSyncResult {
  total: number;
  new: number;
  updated: number;
  matched: number;
  errors: string[];
}

interface MatchResult {
  deviceId: string;
  carId: string;
  confidence: number;
  method: string;
}

export class StarlineDevicesSyncService {
  constructor() {
    // Используем singleton scraper, который уже инициализирован
  }

  /**
   * Синхронизировать все устройства из Starline
   */
  async syncDevices(): Promise<DeviceSyncResult> {
    console.log('🔄 Начинаем синхронизацию устройств Starline...');

    const result: DeviceSyncResult = {
      total: 0,
      new: 0,
      updated: 0,
      matched: 0,
      errors: []
    };

    try {
      // Получаем все устройства из Starline через persistent scraper
      const scraper = getStarlineScraper();
      const devices = await scraper.getDevices();
      result.total = devices.length;
      console.log(`📡 Получено ${devices.length} устройств из Starline`);

      for (const device of devices) {
        try {
          // Получаем детальную информацию
          const details = await scraper.getDeviceDetails(device.device_id);

          // Upsert в таблицу starline_devices
          const sqlConnection = getSqlConnection();
          const upsertResult = await sqlConnection`
            INSERT INTO starline_devices (
              device_id,
              alias,
              imei,
              phone,
              sn,
              device_type,
              fw_version,
              last_seen,
              active
            ) VALUES (
              ${device.device_id},
              ${device.alias},
              ${details.imei || null},
              ${details.phone || null},
              ${details.sn || null},
              ${details.type || null},
              ${details.fw_version || null},
              NOW(),
              ${device.status === 1}
            )
            ON CONFLICT (device_id) DO UPDATE SET
              alias = EXCLUDED.alias,
              imei = EXCLUDED.imei,
              phone = EXCLUDED.phone,
              sn = EXCLUDED.sn,
              device_type = EXCLUDED.device_type,
              fw_version = EXCLUDED.fw_version,
              last_seen = EXCLUDED.last_seen,
              active = EXCLUDED.active
            RETURNING id, (xmax = 0) AS is_new
          `;

          const row = upsertResult[0] as { id: string; is_new: boolean };
          
          if (row.is_new) {
            result.new++;
            console.log(`✅ Новое устройство: ${device.alias}`);
          } else {
            result.updated++;
            console.log(`🔄 Обновлено: ${device.alias}`);
          }

        } catch (error) {
          const errorMsg = `Ошибка обработки устройства ${device.alias}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`\n✅ Синхронизация завершена:`);
      console.log(`   Всего: ${result.total}`);
      console.log(`   Новых: ${result.new}`);
      console.log(`   Обновлено: ${result.updated}`);
      console.log(`   Ошибок: ${result.errors.length}`);

    } catch (error) {
      const errorMsg = `Критическая ошибка синхронизации: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Автоматическое сопоставление устройств с cars
   */
  async matchDevicesWithCars(): Promise<MatchResult[]> {
    console.log('🔍 Начинаем сопоставление устройств с машинами...');

    const matches: MatchResult[] = [];

    // Получаем несопоставленные устройства
    const sqlConnection = getSqlConnection();
    const devices = await sqlConnection`
      SELECT 
        id,
        device_id,
        alias,
        extracted_model,
        extracted_digits
      FROM starline_devices
      WHERE matched = FALSE
        AND extracted_digits IS NOT NULL
        AND active = TRUE
    ` as Array<{
      id: string;
      device_id: number;
      alias: string;
      extracted_model: string;
      extracted_digits: string;
    }>;

    console.log(`📋 Найдено ${devices.length} несопоставленных устройств`);

    // Получаем все машины из БД
    const cars = await sqlConnection`
      SELECT 
        id,
        license_plate,
        brand,
        model
      FROM cars
      WHERE license_plate IS NOT NULL
    ` as Array<{
      id: string;
      license_plate: string;
      brand: string;
      model: string;
    }>;

    console.log(`🚗 Найдено ${cars.length} машин в БД`);

    // Сопоставляем
    for (const device of devices) {
      let bestMatch: { car: typeof cars[0]; confidence: number; method: string } | null = null;

      for (const car of cars) {
        // Извлекаем 3 цифры из номера
        const licensePlateDigits = car.license_plate.match(/\d{3}/)?.[0];
        
        if (!licensePlateDigits || licensePlateDigits !== device.extracted_digits) {
          continue; // Цифры не совпадают
        }

        // Цифры совпали, проверяем модель
        const carModel = `${car.brand} ${car.model}`.toLowerCase();
        const deviceModel = device.extracted_model.toLowerCase();

        let confidence = 0.6; // Базовая уверенность за совпадение цифр
        let method = 'auto_digits_only';

        // Проверяем совпадение модели
        if (carModel.includes(deviceModel) || deviceModel.includes(carModel)) {
          confidence = 0.95; // Высокая уверенность: цифры + модель
          method = 'auto_model_digits';
        } else if (this.fuzzyMatch(carModel, deviceModel)) {
          confidence = 0.8; // Средняя уверенность: цифры + похожая модель
          method = 'auto_fuzzy_match';
        }

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { car, confidence, method };
        }
      }

      if (bestMatch) {
        // Сохраняем сопоставление
        await sqlConnection`
          UPDATE starline_devices
          SET 
            car_id = ${bestMatch.car.id},
            matched = TRUE,
            match_confidence = ${bestMatch.confidence},
            match_method = ${bestMatch.method},
            match_notes = 'Автоматически сопоставлено: ' || ${device.extracted_digits} || ' + ' || ${bestMatch.car.brand} || ' ' || ${bestMatch.car.model}
          WHERE id = ${device.id}
        `;

        // Записываем в историю
        await sqlConnection`
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
            ${device.id},
            ${bestMatch.car.id},
            TRUE,
            ${bestMatch.confidence},
            ${bestMatch.method},
            ${device.alias},
            ${device.extracted_digits},
            ${device.extracted_model},
            ${bestMatch.car.license_plate},
            ${bestMatch.car.brand},
            ${bestMatch.car.model},
            'Автоматическое сопоставление',
            'system'
          )
        `;

        matches.push({
          deviceId: device.id,
          carId: bestMatch.car.id,
          confidence: bestMatch.confidence,
          method: bestMatch.method
        });

        console.log(`✅ Сопоставлено: ${device.alias} → ${bestMatch.car.brand} ${bestMatch.car.model} (${bestMatch.car.license_plate}) [${(bestMatch.confidence * 100).toFixed(0)}%]`);
      } else {
        console.log(`❌ Не найдено совпадение для: ${device.alias} (${device.extracted_digits})`);
      }
    }

    console.log(`\n✅ Сопоставление завершено: ${matches.length} из ${devices.length}`);
    return matches;
  }

  /**
   * Нечеткое сравнение строк (простой алгоритм)
   */
  private fuzzyMatch(str1: string, str2: string): boolean {
    // Разбиваем на слова
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    // Проверяем есть ли совпадающие слова
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          if (word1.length > 2 && word2.length > 2) { // Игнорируем короткие слова
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Получить статус синхронизации
   */
  async getSyncStatus(): Promise<{
    total: number;
    matched: number;
    unmatched: number;
    inactive: number;
  }> {
    const sqlConnection = getSqlConnection();
    const result = await sqlConnection`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE matched = TRUE) as matched,
        COUNT(*) FILTER (WHERE matched = FALSE) as unmatched,
        COUNT(*) FILTER (WHERE active = FALSE) as inactive
      FROM starline_devices
    `;

    const row = result[0] as {
      total: string;
      matched: string;
      unmatched: string;
      inactive: string;
    };

    return {
      total: parseInt(row.total),
      matched: parseInt(row.matched),
      unmatched: parseInt(row.unmatched),
      inactive: parseInt(row.inactive)
    };
  }
}

export default StarlineDevicesSyncService;

