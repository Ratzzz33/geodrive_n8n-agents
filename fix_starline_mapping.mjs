#!/usr/bin/env node
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

// Правильные соответствия
const correctMappings = [
  { device_id: '864107072502972', plate: 'EP021EP' },
  { device_id: '869573070847963', plate: 'BE021ES' }
];

async function fixMappings() {
  console.log('🔧 Исправление соответствий Starline устройств\n');
  
  try {
    for (const mapping of correctMappings) {
      console.log(`\n📋 Проверка: device_id ${mapping.device_id} → ${mapping.plate}`);
      
      // 1. Получаем машину по номеру
      const car = await sql`
        SELECT id, plate, model, avatar_url
        FROM cars
        WHERE plate = ${mapping.plate}
        LIMIT 1
      `;
      
      if (car.length === 0) {
        console.log(`   ❌ Машина ${mapping.plate} не найдена в БД`);
        continue;
      }
      
      const carData = car[0];
      console.log(`   ✅ Машина найдена: ${carData.model || 'N/A'} (ID: ${carData.id})`);
      
      // 2. Проверяем текущее состояние в starline_devices
      const currentDevice = await sql`
        SELECT 
          id,
          device_id,
          car_id,
          alias,
          matched,
          active,
          avatar_url
        FROM starline_devices
        WHERE device_id = ${mapping.device_id}
        LIMIT 1
      `;
      
      if (currentDevice.length === 0) {
        console.log(`   ⚠️ Устройство ${mapping.device_id} не найдено в starline_devices`);
        console.log(`   💡 Создаю новую запись...`);
        
        // Создаем новую запись
        await sql`
          INSERT INTO starline_devices (
            device_id,
            car_id,
            matched,
            active,
            match_confidence,
            match_method,
            avatar_url,
            created_at,
            updated_at
          ) VALUES (
            ${mapping.device_id},
            ${carData.id},
            TRUE,
            TRUE,
            1.0,
            'manual_fix',
            ${carData.avatar_url || null},
            NOW(),
            NOW()
          )
        `;
        
        console.log(`   ✅ Создана новая запись: device_id ${mapping.device_id} → car_id ${carData.id}`);
        if (carData.avatar_url) {
          console.log(`   ✅ Avatar URL обновлен: ${carData.avatar_url}`);
        } else {
          console.log(`   ⚠️ Avatar URL отсутствует у машины ${mapping.plate}`);
        }
        continue;
      }
      
      const deviceData = currentDevice[0];
      console.log(`   Текущее состояние:`);
      console.log(`      device_id: ${deviceData.device_id}`);
      console.log(`      car_id: ${deviceData.car_id}`);
      console.log(`      alias: ${deviceData.alias || 'N/A'}`);
      console.log(`      matched: ${deviceData.matched}`);
      console.log(`      active: ${deviceData.active}`);
      console.log(`      avatar_url: ${deviceData.avatar_url || 'N/A'}`);
      
      // 3. Проверяем, правильно ли уже связано
      if (deviceData.car_id === carData.id) {
        console.log(`   ✅ Уже правильно связано с ${mapping.plate}`);
        
        // Проверяем, что matched, active и avatar_url установлены правильно
        const avatarNeedsUpdate = carData.avatar_url !== deviceData.avatar_url;
        const needsUpdate = !deviceData.matched || !deviceData.active || avatarNeedsUpdate;
        
        if (needsUpdate) {
          console.log(`   ⚠️ Обновляю matched, active и avatar_url...`);
          await sql`
            UPDATE starline_devices
            SET
              matched = TRUE,
              active = TRUE,
              match_confidence = 1.0,
              match_method = 'manual_fix',
              avatar_url = ${carData.avatar_url || null},
              updated_at = NOW()
            WHERE device_id = ${mapping.device_id}
          `;
          console.log(`   ✅ Обновлено: matched=TRUE, active=TRUE`);
          if (carData.avatar_url) {
            console.log(`   ✅ Avatar URL обновлен: ${carData.avatar_url}`);
          }
        } else {
          console.log(`   ✅ Все поля уже актуальны`);
        }
        continue;
      }
      
      // 4. Проверяем, с какой машиной сейчас связано
      if (deviceData.car_id) {
        const currentCar = await sql`
          SELECT plate, model
          FROM cars
          WHERE id = ${deviceData.car_id}
          LIMIT 1
        `;
        
        if (currentCar.length > 0) {
          console.log(`   ⚠️ Сейчас связано с: ${currentCar[0].plate} (${currentCar[0].model || 'N/A'})`);
          console.log(`   ❌ НЕПРАВИЛЬНО! Должно быть: ${mapping.plate}`);
        } else {
          console.log(`   ⚠️ Связано с несуществующей машиной (car_id: ${deviceData.car_id})`);
        }
      } else {
        console.log(`   ⚠️ Не связано ни с какой машиной (car_id: NULL)`);
      }
      
      // 5. Исправляем связь и обновляем avatar_url
      console.log(`   🔧 Исправляю связь и обновляю avatar_url...`);
      await sql`
        UPDATE starline_devices
        SET
          car_id = ${carData.id},
          matched = TRUE,
          active = TRUE,
          match_confidence = 1.0,
          match_method = 'manual_fix',
          avatar_url = ${carData.avatar_url || null},
          updated_at = NOW()
        WHERE device_id = ${mapping.device_id}
      `;
      
      console.log(`   ✅ Исправлено: device_id ${mapping.device_id} → car_id ${carData.id} (${mapping.plate})`);
      if (carData.avatar_url) {
        console.log(`   ✅ Avatar URL обновлен: ${carData.avatar_url}`);
      } else {
        console.log(`   ⚠️ Avatar URL отсутствует у машины ${mapping.plate}`);
      }
      
      // 6. Проверяем, не связана ли другая машина с этим device_id
      const otherDevices = await sql`
        SELECT 
          sd.device_id,
          c.plate,
          c.model
        FROM starline_devices sd
        JOIN cars c ON c.id = sd.car_id
        WHERE sd.car_id = ${carData.id}
          AND sd.device_id != ${mapping.device_id}
          AND sd.matched = TRUE
      `;
      
      if (otherDevices.length > 0) {
        console.log(`   ⚠️ ВНИМАНИЕ: У машины ${mapping.plate} есть другие связанные устройства:`);
        for (const other of otherDevices) {
          console.log(`      - device_id ${other.device_id}`);
        }
        console.log(`   💡 Рекомендуется проверить эти связи вручную`);
      }
    }
    
    // 7. Финальная проверка
    console.log(`\n` + '='.repeat(60));
    console.log('✅ ФИНАЛЬНАЯ ПРОВЕРКА:');
    console.log('='.repeat(60));
    
    for (const mapping of correctMappings) {
      const check = await sql`
        SELECT 
          sd.device_id,
          sd.car_id,
          sd.matched,
          sd.active,
          sd.avatar_url,
          c.plate,
          c.model,
          c.avatar_url as car_avatar_url
        FROM starline_devices sd
        LEFT JOIN cars c ON c.id = sd.car_id
        WHERE sd.device_id = ${mapping.device_id}
        LIMIT 1
      `;
      
      if (check.length > 0) {
        const data = check[0];
        const isCorrect = data.plate === mapping.plate;
        const avatarMatch = data.avatar_url === data.car_avatar_url;
        console.log(`\n${isCorrect ? '✅' : '❌'} device_id ${mapping.device_id}:`);
        console.log(`   Машина: ${data.plate || 'N/A'} (${data.model || 'N/A'})`);
        console.log(`   Ожидается: ${mapping.plate}`);
        console.log(`   matched: ${data.matched ? '✅' : '❌'}`);
        console.log(`   active: ${data.active ? '✅' : '❌'}`);
        console.log(`   avatar_url: ${data.avatar_url ? '✅ ' + data.avatar_url : '❌ отсутствует'}`);
        if (data.car_avatar_url && !avatarMatch) {
          console.log(`   ⚠️ avatar_url не совпадает с cars.avatar_url`);
        } else if (data.car_avatar_url && avatarMatch) {
          console.log(`   ✅ avatar_url синхронизирован с cars`);
        }
      } else {
        console.log(`\n❌ device_id ${mapping.device_id}: не найдено`);
      }
    }
    
    console.log(`\n✅ Исправление завершено!`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

fixMappings().catch(console.error);

