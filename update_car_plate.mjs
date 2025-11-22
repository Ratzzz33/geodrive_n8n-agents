#!/usr/bin/env node
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: join(__dirname, '.env') });

const sql = postgres(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

const RENTPROG_ID = '55207';
const NEW_PLATE = 'MM438JM';
const STARLINE_DEVICE_ID = '864326067074728';

async function updateCarPlate() {
  try {
    console.log('='.repeat(60));
    console.log(`🚗 Обновление госномера для машины RentProg ID: ${RENTPROG_ID}`);
    console.log(`📋 Новый госномер: ${NEW_PLATE}`);
    console.log('='.repeat(60));
    console.log('');
    
    // 1. Находим машину по rentprog_id
    console.log('🔍 Поиск машины в БД...');
    const carData = await sql`
      SELECT 
        c.id,
        c.plate as current_plate,
        c.car_visual_name,
        c.model,
        c.branch_id,
        b.code as branch_code,
        er.external_id as rentprog_id
      FROM external_refs er
      JOIN cars c ON c.id = er.entity_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND er.external_id = ${RENTPROG_ID}
    `;
    
    if (carData.length === 0) {
      console.log('❌ Машина с RentProg ID не найдена в БД');
      console.log('💡 Возможно, нужно сначала синхронизировать машину из RentProg');
      return;
    }
    
    const car = carData[0];
    console.log(`✅ Найдена машина:`);
    console.log(`   ID: ${car.id}`);
    console.log(`   Текущий номер: ${car.current_plate || 'не указан'}`);
    console.log(`   Модель: ${car.car_visual_name || ''} ${car.model || ''}`);
    console.log(`   Филиал: ${car.branch_code || 'не указан'}`);
    console.log('');
    
    // 2. Проверяем текущий номер
    const currentPlate = (car.current_plate || '').trim().toUpperCase();
    const newPlateNormalized = NEW_PLATE.trim().toUpperCase();
    
    if (currentPlate === newPlateNormalized) {
      console.log(`  ℹ️  Номер уже правильный: ${car.current_plate}`);
    } else {
      // Проверяем, не занят ли новый номер другой машиной
      console.log(`🔍 Проверка занятости нового номера ${NEW_PLATE}...`);
      const existingCar = await sql`
        SELECT c.id, c.plate, c.model
        FROM cars c
        WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE(${NEW_PLATE}, ' ', ''))
          AND c.id != ${car.id}
      `;
      
      if (existingCar.length > 0) {
        const conflict = existingCar[0];
        console.log(`  ⚠️  Номер ${NEW_PLATE} уже занят другой машиной:`);
        console.log(`      ID: ${conflict.id}`);
        console.log(`      Модель: ${conflict.model || 'не указана'}`);
        console.log('');
        console.log('❌ Не могу обновить - номер занят другой машиной');
        return;
      }
      
      console.log(`  ✅ Номер ${NEW_PLATE} свободен`);
    }
    console.log('');
    
    // 3. Находим устройство Starline по device_id
    console.log(`🔍 Поиск устройства Starline (device_id: ${STARLINE_DEVICE_ID})...`);
    const starlineDevice = await sql`
      SELECT 
        id,
        device_id,
        plate as current_plate,
        car_id,
        matched,
        active,
        alias
      FROM starline_devices
      WHERE device_id = ${BigInt(STARLINE_DEVICE_ID)}
    `;
    
    if (starlineDevice.length === 0) {
      console.log(`  ❌ Устройство Starline с device_id ${STARLINE_DEVICE_ID} не найдено`);
      console.log('  💡 Проверьте правильность device_id');
      return;
    }
    
    const device = starlineDevice[0];
    console.log(`  ✅ Найдено устройство:`);
    console.log(`     Device ID: ${device.device_id}`);
    console.log(`     Текущий номер: ${device.current_plate || 'не указан'}`);
    console.log(`     Alias: ${device.alias || 'не указан'}`);
    console.log(`     Car ID: ${device.car_id || 'не связана'}`);
    console.log(`     Связано с машиной: ${device.matched ? 'да' : 'нет'}`);
    console.log(`     Активно: ${device.active ? 'да' : 'нет'}`);
    
    // Проверяем, связано ли устройство с правильной машиной
    if (device.car_id && device.car_id !== car.id) {
      console.log('');
      console.log(`  ⚠️  Устройство связано с другой машиной (ID: ${device.car_id})`);
      console.log(`  💡 Будет обновлена связь с машиной ${car.id} (${NEW_PLATE})`);
    }
    console.log('');
    
    // 4. Обновляем номер в таблице cars (если нужно)
    const needsUpdate = currentPlate !== newPlateNormalized;
    if (needsUpdate) {
      console.log('💾 Обновление номера в таблице cars...');
      await sql`
        UPDATE cars
        SET plate = ${NEW_PLATE},
            updated_at = NOW()
        WHERE id = ${car.id}
      `;
      console.log(`  ✅ Обновлен номер в таблице cars: ${car.current_plate || 'не указан'} → ${NEW_PLATE}`);
    } else {
      console.log('  ℹ️  Номер в таблице cars уже правильный, пропускаем обновление');
    }
    
    // 5. Обновляем номер и связь в таблице starline_devices
    const devicePlate = (device.current_plate || '').trim().toUpperCase();
    const needsDeviceUpdate = devicePlate !== newPlateNormalized || device.car_id !== car.id;
    
    if (needsDeviceUpdate) {
      console.log('💾 Обновление устройства Starline...');
      await sql`
        UPDATE starline_devices
        SET plate = ${NEW_PLATE},
            car_id = ${car.id},
            matched = true,
            updated_at = NOW()
        WHERE device_id = ${BigInt(STARLINE_DEVICE_ID)}
      `;
      
      if (devicePlate !== newPlateNormalized) {
        console.log(`  ✅ Обновлен номер: ${device.current_plate || 'не указан'} → ${NEW_PLATE}`);
      }
      if (device.car_id !== car.id) {
        console.log(`  ✅ Обновлена связь с машиной: ${device.car_id || 'не связана'} → ${car.id} (${NEW_PLATE})`);
      }
    } else {
      console.log(`  ℹ️  Устройство уже правильно настроено:`);
      console.log(`     Номер: ${device.current_plate || 'не указан'}`);
      console.log(`     Связано с машиной: ${device.matched ? 'да' : 'нет'}`);
    }
    
    // 6. Проверяем результат
    console.log('\n📋 Проверка результата:');
    const updatedCar = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        sd.plate as starline_plate,
        sd.device_id
      FROM cars c
      LEFT JOIN starline_devices sd ON sd.car_id = c.id
      WHERE c.id = ${car.id}
    `;
    
    const updated = updatedCar[0];
    console.log(`  Номер в cars: ${updated.plate || 'не указан'}`);
    
    // Проверяем устройство Starline
    const checkDevice = await sql`
      SELECT device_id, plate, car_id, matched
      FROM starline_devices
      WHERE device_id = ${BigInt(STARLINE_DEVICE_ID)}
    `;
    
    if (checkDevice.length > 0) {
      const dev = checkDevice[0];
      console.log(`  Номер в starline_devices: ${dev.plate || 'не указан'}`);
      console.log(`  Device ID: ${dev.device_id}`);
      console.log(`  Связано с машиной: ${dev.matched ? 'да' : 'нет'}`);
      console.log(`  Car ID: ${dev.car_id || 'не связана'}`);
    } else {
      console.log(`  Устройство Starline: не найдено`);
    }
    
    console.log('\n✅ Обновление завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
}

updateCarPlate();

