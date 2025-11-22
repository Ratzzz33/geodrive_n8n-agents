#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkEventDetails() {
  try {
    const rentprogId = '39736';
    const eventTime = '2025-11-21 11:15:01';
    
    console.log('🔍 Детальная проверка события изменения company_id для машины 39736\n');
    console.log('='.repeat(80));
    
    // 1. Найти событие в БД
    console.log('\n📋 1. Поиск события в БД');
    console.log('-'.repeat(80));
    
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
        AND e.ts >= '2025-11-21 11:14:00'::timestamptz
        AND e.ts <= '2025-11-21 11:16:00'::timestamptz
      ORDER BY e.ts DESC
    `;
    
    if (events.length === 0) {
      console.log('❌ Событие не найдено в БД в указанное время');
      console.log('   Проверяю все события за 21.11.2025...\n');
      
      const allEvents = await sql`
        SELECT 
          e.id,
          e.ts,
          e.type,
          e.event_name,
          e.company_id,
          e.processed,
          e.ok,
          e.payload,
          e.metadata
        FROM events e
        WHERE e.rentprog_id = ${rentprogId}
          AND e.ts >= '2025-11-21 00:00:00'::timestamptz
          AND e.ts < '2025-11-22 00:00:00'::timestamptz
        ORDER BY e.ts DESC
      `;
      
      if (allEvents.length > 0) {
        console.log(`✅ Найдено событий за 21.11.2025: ${allEvents.length}\n`);
        allEvents.forEach((e, idx) => {
          const date = new Date(e.ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
          console.log(`${idx + 1}. ${e.event_name || e.type || 'unknown'}`);
          console.log(`   Время: ${date}`);
          console.log(`   Company ID: ${e.company_id || 'N/A'}`);
          console.log(`   Обработано: ${e.processed ? '✓' : '○'}`);
          console.log(`   Успешно: ${e.ok ? '✓' : '✗'}`);
          
          // Показываем payload
          if (e.payload) {
            try {
              const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
              console.log(`\n   📄 Payload:`);
              console.log(JSON.stringify(payload, null, 2));
            } catch (err) {
              console.log(`   ⚠️  Ошибка парсинга payload`);
            }
          }
          
          console.log('');
        });
      } else {
        console.log('❌ События за 21.11.2025 не найдены');
      }
    } else {
      console.log(`✅ Найдено событий: ${events.length}\n`);
      events.forEach((e, idx) => {
        const date = new Date(e.ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
        console.log(`${idx + 1}. Событие ID: ${e.id}`);
        console.log(`   Время: ${date}`);
        console.log(`   Тип: ${e.event_name || e.type || 'unknown'}`);
        console.log(`   Операция: ${e.operation || 'N/A'}`);
        console.log(`   Company ID: ${e.company_id || 'N/A'}`);
        console.log(`   Обработано: ${e.processed ? '✓' : '○'}`);
        console.log(`   Успешно: ${e.ok ? '✓' : '✗'}`);
        if (e.reason) console.log(`   Причина ошибки: ${e.reason}`);
        
        // Анализ payload
        if (e.payload) {
          try {
            const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
            console.log(`\n   📄 Payload:`);
            console.log(JSON.stringify(payload, null, 2));
            
            // Проверяем company_id в payload
            if (payload.company_id) {
              console.log(`\n   🔍 Company ID в payload: ${JSON.stringify(payload.company_id)}`);
              if (Array.isArray(payload.company_id)) {
                console.log(`      Массив: [${payload.company_id.join(', ')}]`);
                console.log(`      Последний элемент (новый): ${payload.company_id[payload.company_id.length - 1]}`);
              } else {
                console.log(`      Значение: ${payload.company_id}`);
              }
            }
            
            if (payload.branch_name) {
              console.log(`   🌍 Branch name в payload: ${payload.branch_name}`);
            }
            
          } catch (err) {
            console.log(`   ⚠️  Ошибка парсинга payload: ${err.message}`);
          }
        }
        
        // Анализ metadata
        if (e.metadata) {
          try {
            const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
            console.log(`\n   📋 Metadata:`);
            console.log(JSON.stringify(metadata, null, 2));
          } catch (err) {
            // Игнорируем ошибки парсинга
          }
        }
        
        console.log('');
      });
    }
    
    // 2. Проверить текущее состояние машины в БД
    console.log('\n📋 2. Текущее состояние машины в БД');
    console.log('-'.repeat(80));
    
    const cars = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.branch_id,
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
    
    if (cars.length > 0) {
      const car = cars[0];
      console.log('✅ Машина найдена:');
      console.log(`   ID: ${car.id}`);
      console.log(`   Номер: ${car.plate || 'N/A'}`);
      console.log(`   Модель: ${car.model || 'N/A'}`);
      console.log(`   Branch ID: ${car.branch_id || 'N/A'}`);
      console.log(`   Branch Code: ${car.branch_code || 'N/A'}`);
      console.log(`   Branch Name: ${car.branch_name || 'N/A'}`);
      
      // Маппинг company_id → branch
      const companyToBranch = {
        9247: 'tbilisi',
        9248: 'kutaisi',
        9506: 'batumi',
        11163: 'service-center'
      };
      
      console.log('\n   🔍 Ожидаемый branch по company_id:');
      console.log(`      company_id 11163 → ${companyToBranch[11163]} (старый)`);
      console.log(`      company_id 9247 → ${companyToBranch[9247]} (новый)`);
      console.log(`      Текущий branch в БД: ${car.branch_code}`);
      
      if (car.branch_code !== companyToBranch[9247]) {
        console.log(`\n   ⚠️  ПРОБЛЕМА: Branch в БД (${car.branch_code}) не соответствует новому company_id (9247 → tbilisi)`);
      } else {
        console.log(`\n   ✅ Branch в БД соответствует новому company_id`);
      }
    }
    
    // 3. Проверить маппинг company_id → branch
    console.log('\n📋 3. Маппинг company_id → branch');
    console.log('-'.repeat(80));
    
    const branches = await sql`
      SELECT id, code, name FROM branches ORDER BY code
    `;
    
    console.log('Доступные филиалы в БД:');
    branches.forEach(b => {
      console.log(`   ${b.code}: ${b.name} (ID: ${b.id})`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Проверка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkEventDetails();

