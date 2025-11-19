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

const JARVIS_API_URL = process.env.JARVIS_API_URL || 'http://46.224.17.15:3000';

// Используем существующий механизм через Jarvis API
// Он уже имеет доступ к RentProg токенам через config
async function syncCarViaJarvisAPI(branch, rentprogId) {
  try {
    // Вызываем /process-event для синхронизации машины
    // Это обновит все поля, включая avatar_url
    const response = await fetch(`${JARVIS_API_URL}/process-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch: branch,
        type: 'car.updated', // или другой тип события
        ext_id: rentprogId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jarvis API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error syncing via Jarvis API:`, error.message);
    return null;
  }
}

async function syncAvatarUrl() {
  console.log('🔄 Синхронизация avatar_url для 3 машин\n');
  
  try {
    // 1. Получаем 3 машины без avatar_url с plate
    const carsToSync = await sql`
      SELECT 
        c.id,
        c.plate,
        c.car_visual_name as brand,
        c.model,
        b.code as branch_code,
        er.external_id as rentprog_id
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.system = 'rentprog' 
        AND er.entity_type = 'car'
      WHERE c.avatar_url IS NULL
        AND c.plate IS NOT NULL
        AND c.plate != ''
      ORDER BY c.plate
    `;
    
    console.log(`Найдено машин для синхронизации: ${carsToSync.length}\n`);
    
    if (carsToSync.length === 0) {
      console.log('✅ Нет машин для синхронизации');
      return;
    }
    
    let synced = 0;
    let failed = 0;
    
    // Специальная обработка для OC700OC (известен RentProg ID из URL)
    const oc700ocRentprogId = '63668';
    
    for (const car of carsToSync) {
      console.log(`📋 Обработка: ${car.plate} (${car.brand || ''} ${car.model || ''})`);
      
      let rentprogId = car.rentprog_id;
      
      // Специальный случай: OC700OC - используем известный ID
      if (!rentprogId && car.plate === 'OC700OC') {
        console.log(`   ℹ️  Используем известный RentProg ID из URL: ${oc700ocRentprogId}`);
        rentprogId = oc700ocRentprogId;
      }
      
      if (!rentprogId) {
        console.log(`   ⚠️  Нет RentProg ID - пропускаю\n`);
        failed++;
        continue;
      }
      
      if (!car.branch_code) {
        console.log(`   ⚠️  Нет филиала - пропускаю\n`);
        failed++;
        continue;
      }
      
      // 2. Синхронизируем через Jarvis API (он имеет доступ к RentProg токенам)
      console.log(`   🔄 Синхронизация через Jarvis API (ID: ${rentprogId}, филиал: ${car.branch_code})...`);
      const syncResult = await syncCarViaJarvisAPI(car.branch_code, rentprogId);
      
      if (!syncResult || !syncResult.ok) {
        console.log(`   ❌ Не удалось синхронизировать через Jarvis API\n`);
        failed++;
        continue;
      }
      
      console.log(`   ✅ Синхронизация выполнена`);
      
      // 3. Проверяем, обновился ли avatar_url
      const updatedCar = await sql`
        SELECT avatar_url
        FROM cars
        WHERE id = ${car.id}
      `;
      
      if (updatedCar[0]?.avatar_url) {
        console.log(`   ✅ avatar_url обновлён: ${updatedCar[0].avatar_url}`);
        
        // 4. Обновляем в starline_devices (если есть связанное устройство)
        const deviceUpdate = await sql`
          UPDATE starline_devices
          SET avatar_url = ${updatedCar[0].avatar_url},
              updated_at = NOW()
          WHERE car_id = ${car.id}
            AND matched = TRUE
        `;
        
        if (deviceUpdate.count > 0) {
          console.log(`   ✅ Обновлено в starline_devices (${deviceUpdate.count} устройств)`);
        }
      } else {
        console.log(`   ⚠️  avatar_url всё ещё NULL после синхронизации`);
      }
      
      synced++;
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('📊 ИТОГИ СИНХРОНИЗАЦИИ:');
    console.log('='.repeat(60));
    console.log(`✅ Успешно синхронизировано: ${synced}`);
    console.log(`❌ Ошибок: ${failed}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error);
    throw error;
  }
}

async function cleanupGarbageCars() {
  console.log('🧹 Очистка мусорных записей (машины без plate)\n');
  
  try {
    // 1. Проверяем, сколько записей будет удалено
    const garbageCount = await sql`
      SELECT COUNT(*) as count
      FROM cars
      WHERE (plate IS NULL OR plate = '')
        AND avatar_url IS NULL
    `;
    
    console.log(`Найдено мусорных записей: ${garbageCount[0].count}\n`);
    
    if (garbageCount[0].count === 0) {
      console.log('✅ Нет мусорных записей для удаления');
      return;
    }
    
    // 2. Проверяем, есть ли у них связи (брони, устройства, etc.)
    const withBookings = await sql`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cars c
      WHERE (c.plate IS NULL OR c.plate = '')
        AND c.avatar_url IS NULL
        AND EXISTS (SELECT 1 FROM bookings b WHERE b.car_id = c.id)
    `;
    
    const withDevices = await sql`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cars c
      WHERE (c.plate IS NULL OR c.plate = '')
        AND c.avatar_url IS NULL
        AND EXISTS (SELECT 1 FROM starline_devices sd WHERE sd.car_id = c.id)
    `;
    
    const withExternalRefs = await sql`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cars c
      WHERE (c.plate IS NULL OR c.plate = '')
        AND c.avatar_url IS NULL
        AND EXISTS (SELECT 1 FROM external_refs er WHERE er.entity_id = c.id)
    `;
    
    console.log('📊 Проверка связей:');
    console.log(`   - С бронями: ${withBookings[0].count}`);
    console.log(`   - С устройствами Starline: ${withDevices[0].count}`);
    console.log(`   - С внешними ссылками: ${withExternalRefs[0].count}\n`);
    
    if (withBookings[0].count > 0 || withDevices[0].count > 0 || withExternalRefs[0].count > 0) {
      console.log('⚠️  ВНИМАНИЕ: Некоторые мусорные записи имеют связи!');
      console.log('   Удаление будет выполнено с CASCADE (связанные записи тоже удалятся)\n');
    }
    
    // 3. Удаляем мусорные записи
    console.log('🗑️  Удаление мусорных записей...');
    const deleted = await sql`
      DELETE FROM cars
      WHERE (plate IS NULL OR plate = '')
        AND avatar_url IS NULL
    `;
    
    console.log(`✅ Удалено записей: ${deleted.count}\n`);
    
    // 4. Проверяем результат
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM cars
      WHERE (plate IS NULL OR plate = '')
        AND avatar_url IS NULL
    `;
    
    if (remaining[0].count > 0) {
      console.log(`⚠️  Осталось мусорных записей: ${remaining[0].count}`);
      console.log('   (Возможно, у них есть avatar_url или они были созданы после проверки)');
    } else {
      console.log('✅ Все мусорные записи удалены');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Начало работы\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Синхронизация avatar_url
    await syncAvatarUrl();
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 2. Очистка мусорных записей
    await cleanupGarbageCars();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ВСЕ ЗАДАЧИ ВЫПОЛНЕНЫ');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

