#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCarActions() {
  try {
    const rentprogId = '39736';
    
    console.log('🔍 Проверка действий с машиной RentProg ID: 39736\n');
    console.log('='.repeat(80));
    
    // 1. Найти машину в БД
    console.log('\n📋 1. Поиск машины в БД');
    console.log('-'.repeat(80));
    
    const cars = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.vin,
        c.state,
        c.updated_at,
        b.code as branch_code,
        b.name as branch_name,
        er.external_id as rentprog_id
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car' 
        AND er.system = 'rentprog'
      WHERE er.external_id = ${rentprogId}
    `;
    
    if (cars.length === 0) {
      console.log('❌ Машина с RentProg ID 39736 НЕ НАЙДЕНА в БД');
      console.log('   Возможно, машина еще не синхронизирована или ID неверный');
      return;
    }
    
    const car = cars[0];
    console.log('✅ Машина найдена:');
    console.log(`   ID: ${car.id}`);
    console.log(`   Номер: ${car.plate || 'N/A'}`);
    console.log(`   Модель: ${car.model || 'N/A'}`);
    console.log(`   VIN: ${car.vin || 'N/A'}`);
    console.log(`   Состояние: ${car.state || 'N/A'}`);
    console.log(`   Филиал: ${car.branch_name || 'N/A'} (${car.branch_code || 'N/A'})`);
    console.log(`   Последнее обновление в БД: ${car.updated_at || 'N/A'}`);
    
    // 2. Проверить события из таблицы events (последние 30 дней)
    console.log('\n📊 2. События с машиной (последние 30 дней)');
    console.log('-'.repeat(80));
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const events = await sql`
      SELECT 
        e.id,
        e.ts,
        e.type,
        e.event_name,
        e.entity_type,
        e.operation,
        e.rentprog_id,
        e.company_id,
        e.processed,
        e.ok,
        e.reason,
        e.payload,
        e.metadata
      FROM events e
      WHERE e.rentprog_id = ${rentprogId}
        AND e.ts >= ${thirtyDaysAgo}::timestamptz
      ORDER BY e.ts DESC
      LIMIT 50
    `;
    
    if (events.length === 0) {
      console.log('❌ События не найдены за последние 30 дней');
    } else {
      console.log(`✅ Найдено событий: ${events.length}\n`);
      
      // Группируем по типам
      const eventsByType = {};
      events.forEach(e => {
        const key = e.event_name || e.type || 'unknown';
        if (!eventsByType[key]) {
          eventsByType[key] = [];
        }
        eventsByType[key].push(e);
      });
      
      console.log('📈 Статистика по типам событий:');
      Object.keys(eventsByType).forEach(type => {
        console.log(`   ${type}: ${eventsByType[type].length}`);
      });
      
      console.log('\n📋 Последние события (топ 20):');
      events.slice(0, 20).forEach((e, idx) => {
        const date = new Date(e.ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
        const statusIcon = e.ok ? '✅' : '❌';
        const processedIcon = e.processed ? '✓' : '○';
        
        console.log(`\n${idx + 1}. ${statusIcon} [${processedIcon}] ${e.event_name || e.type || 'unknown'}`);
        console.log(`   Время: ${date}`);
        console.log(`   Операция: ${e.operation || 'N/A'}`);
        console.log(`   Entity: ${e.entity_type || 'N/A'}`);
        if (e.company_id) console.log(`   Company ID: ${e.company_id}`);
        
        // Извлекаем информацию о пользователе из payload
        if (e.payload) {
          try {
            const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
            
            // Проверяем различные поля где может быть информация о пользователе
            const userId = payload.user_id || payload.user?.id || payload.updated_by || payload.created_by || payload.userId;
            const userName = payload.user?.name || payload.user_name || payload.updated_by_name || payload.created_by_name || payload.userName;
            const userEmail = payload.user?.email || payload.user_email;
            
            if (userId || userName || userEmail) {
              console.log(`   👤 Инициатор:`);
              if (userId) console.log(`      ID: ${userId}`);
              if (userName) console.log(`      Имя: ${userName}`);
              if (userEmail) console.log(`      Email: ${userEmail}`);
            }
            
            // Дополнительная информация из payload
            if (payload.status) console.log(`   Статус: ${payload.status}`);
            if (payload.mileage) console.log(`   Пробег: ${payload.mileage}`);
            if (payload.state) console.log(`   Состояние: ${payload.state}`);
            
            // Проверяем metadata
            if (e.metadata) {
              try {
                const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
                const metaUserId = metadata.user_id || metadata.user?.id || metadata.updated_by || metadata.created_by;
                const metaUserName = metadata.user?.name || metadata.user_name || metadata.updated_by_name || metadata.created_by_name;
                
                if (metaUserId || metaUserName) {
                  console.log(`   👤 Инициатор (из metadata):`);
                  if (metaUserId) console.log(`      ID: ${metaUserId}`);
                  if (metaUserName) console.log(`      Имя: ${metaUserName}`);
                }
              } catch (err) {
                // Игнорируем ошибки парсинга metadata
              }
            }
            
            // Показываем полный payload если нет информации о пользователе
            if (!userId && !userName && !userEmail) {
              console.log(`   📄 Payload (для анализа):`);
              const payloadStr = JSON.stringify(payload, null, 2);
              // Показываем первые 500 символов
              if (payloadStr.length > 500) {
                console.log(`      ${payloadStr.substring(0, 500)}...`);
              } else {
                console.log(`      ${payloadStr}`);
              }
            }
            
          } catch (err) {
            console.log(`   ⚠️  Ошибка парсинга payload: ${err.message}`);
          }
        }
        
        if (e.reason) {
          console.log(`   ⚠️  Причина ошибки: ${e.reason}`);
        }
      });
    }
    
    // 3. Проверить брони связанные с машиной
    console.log('\n📅 3. Брони связанные с машиной (последние 30 дней)');
    console.log('-'.repeat(80));
    
    const bookings = await sql`
      SELECT 
        b.id,
        b.status,
        b.start_at,
        b.end_at,
        b.start_date,
        b.end_date,
        b.created_at,
        b.updated_at,
        b.data,
        c.plate as car_plate,
        cl.name as client_name,
        cl.phone as client_phone
      FROM bookings b
      LEFT JOIN cars c ON c.id = b.car_id
      LEFT JOIN clients cl ON cl.id = b.client_id
      WHERE b.car_id = ${car.id}
        AND (
          b.created_at >= ${thirtyDaysAgo}::timestamptz
          OR b.updated_at >= ${thirtyDaysAgo}::timestamptz
        )
      ORDER BY COALESCE(b.start_date::timestamptz, b.start_at, b.created_at) DESC
      LIMIT 20
    `;
    
    if (bookings.length === 0) {
      console.log('❌ Брони не найдены за последние 30 дней');
    } else {
      console.log(`✅ Найдено броней: ${bookings.length}\n`);
      bookings.forEach((b, idx) => {
        const startDate = b.start_date || b.start_at || b.created_at;
        const endDate = b.end_date || b.end_at;
        const createdDate = new Date(b.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
        const updatedDate = new Date(b.updated_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
        
        console.log(`${idx + 1}. Бронь ID: ${b.id}`);
        console.log(`   Статус: ${b.status || 'N/A'}`);
        console.log(`   Период: ${startDate ? new Date(startDate).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' }) : 'N/A'} - ${endDate ? new Date(endDate).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' }) : 'N/A'}`);
        console.log(`   Клиент: ${b.client_name || 'N/A'} (${b.client_phone || 'N/A'})`);
        console.log(`   Создано: ${createdDate}`);
        console.log(`   Обновлено: ${updatedDate}`);
        
        // Извлекаем информацию о пользователе из data
        if (b.data) {
          try {
            const data = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
            const userId = data.user_id || data.user?.id || data.created_by || data.updated_by;
            const userName = data.user?.name || data.user_name || data.created_by_name || data.updated_by_name;
            
            if (userId || userName) {
              console.log(`   👤 Инициатор:`);
              if (userId) console.log(`      ID: ${userId}`);
              if (userName) console.log(`      Имя: ${userName}`);
            }
          } catch (err) {
            // Игнорируем ошибки парсинга
          }
        }
        console.log('');
      });
    }
    
    // 4. Детальная информация об инициаторах из событий
    console.log('\n👤 4. Детальная информация об инициаторах действий');
    console.log('-'.repeat(80));
    
    if (events.length > 0) {
      console.log('\n📋 Инициаторы из событий:\n');
      const initiators = new Map();
      
      events.forEach(e => {
        if (e.payload) {
          try {
            const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
            const userId = payload.user_id || payload.user?.id || payload.updated_by || payload.created_by;
            const userName = payload.user?.name || payload.user_name || payload.updated_by_name || payload.created_by_name;
            const userEmail = payload.user?.email || payload.user_email;
            
            if (userId) {
              const key = userId.toString();
              if (!initiators.has(key)) {
                initiators.set(key, {
                  id: userId,
                  name: userName,
                  email: userEmail,
                  events: []
                });
              }
              initiators.get(key).events.push({
                type: e.event_name || e.type,
                time: e.ts,
                operation: e.operation
              });
            }
          } catch (err) {
            // Игнорируем ошибки парсинга
          }
        }
      });
      
      if (initiators.size === 0) {
        console.log('❌ Информация об инициаторах не найдена в payload событий');
        console.log('   Попробуем извлечь из самих событий...\n');
        
        // Показываем полный payload последних событий для анализа
        events.slice(0, 3).forEach((e, idx) => {
          console.log(`\nСобытие ${idx + 1} (${e.event_name || e.type}):`);
          if (e.payload) {
            try {
              const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
              console.log(JSON.stringify(payload, null, 2));
            } catch (err) {
              console.log('   Payload не является валидным JSON');
            }
          }
        });
      } else {
        console.log(`✅ Найдено уникальных инициаторов: ${initiators.size}\n`);
        initiators.forEach((initiator, userId) => {
          console.log(`👤 Инициатор ID: ${initiator.id}`);
          if (initiator.name) console.log(`   Имя: ${initiator.name}`);
          if (initiator.email) console.log(`   Email: ${initiator.email}`);
          console.log(`   Количество действий: ${initiator.events.length}`);
          console.log(`   Последнее действие: ${new Date(initiator.events[0].time).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
          console.log(`   Типы действий: ${[...new Set(initiator.events.map(e => e.type))].join(', ')}`);
          console.log('');
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Проверка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkCarActions();

