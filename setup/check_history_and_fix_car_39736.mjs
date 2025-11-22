#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkAndFix() {
  try {
    const rentprogId = '39736';
    const eventTime = '2025-11-21 11:14:55';
    
    console.log('🔍 Проверка записи в history и исправление машины 39736\n');
    console.log('='.repeat(80));
    
    // 1. Проверка записи в history
    console.log('\n📋 1. Поиск записи в таблице history');
    console.log('-'.repeat(80));
    
    const historyRecords = await sql`
      SELECT 
        id,
        ts,
        branch,
        operation_type,
        operation_id,
        description,
        entity_type,
        entity_id,
        user_name,
        created_at,
        matched,
        processed
      FROM history
      WHERE entity_id = ${rentprogId}
        AND description ILIKE '%company_id%'
        AND created_at >= '2025-11-21 11:14:00'::timestamptz
        AND created_at <= '2025-11-21 11:16:00'::timestamptz
      ORDER BY created_at DESC
    `;
    
    if (historyRecords.length === 0) {
      console.log('❌ Запись не найдена в history в указанное время');
      console.log('   Проверяю все записи за 21.11.2025...\n');
      
      const allHistory = await sql`
        SELECT 
          id,
          ts,
          branch,
          operation_type,
          description,
          entity_id,
          user_name,
          created_at
        FROM history
        WHERE entity_id = ${rentprogId}
          AND created_at >= '2025-11-21 00:00:00'::timestamptz
          AND created_at < '2025-11-22 00:00:00'::timestamptz
        ORDER BY created_at DESC
        LIMIT 10
      `;
      
      if (allHistory.length > 0) {
        console.log(`✅ Найдено записей в history за 21.11.2025: ${allHistory.length}\n`);
        allHistory.forEach((h, idx) => {
          const date = new Date(h.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
          console.log(`${idx + 1}. ${h.operation_type || 'unknown'}`);
          console.log(`   Время: ${date}`);
          console.log(`   Филиал: ${h.branch || 'N/A'}`);
          console.log(`   Пользователь: ${h.user_name || 'N/A'}`);
          console.log(`   Описание: ${h.description || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('❌ Записи в history за 21.11.2025 не найдены');
      }
    } else {
      console.log(`✅ Найдено записей: ${historyRecords.length}\n`);
      historyRecords.forEach((h, idx) => {
        const date = new Date(h.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
        console.log(`${idx + 1}. Запись ID: ${h.id}`);
        console.log(`   Время: ${date}`);
        console.log(`   Филиал: ${h.branch || 'N/A'}`);
        console.log(`   Тип операции: ${h.operation_type || 'N/A'}`);
        console.log(`   Пользователь: ${h.user_name || 'N/A'}`);
        console.log(`   Описание: ${h.description || 'N/A'}`);
        console.log(`   Сопоставлено с events: ${h.matched ? '✓' : '○'}`);
        console.log(`   Обработано: ${h.processed ? '✓' : '○'}`);
        console.log('');
      });
    }
    
    // 2. Проверка текущего состояния машины
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
    
    if (cars.length === 0) {
      console.log('❌ Машина не найдена в БД');
      return;
    }
    
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
      
      // 3. Исправление branch_id
      console.log('\n📋 3. Исправление branch_id машины');
      console.log('-'.repeat(80));
      
      const tbilisiBranch = await sql`
        SELECT id, code, name FROM branches WHERE code = 'tbilisi' LIMIT 1
      `;
      
      if (tbilisiBranch.length === 0) {
        console.log('❌ Филиал tbilisi не найден в БД');
        return;
      }
      
      const tbilisiBranchId = tbilisiBranch[0].id;
      console.log(`✅ Филиал tbilisi найден: ID ${tbilisiBranchId}`);
      
      console.log('\n   🔧 Обновляю branch_id машины...');
      await sql`
        UPDATE cars
        SET branch_id = ${tbilisiBranchId},
            updated_at = NOW()
        WHERE id = ${car.id}
      `;
      
      console.log('   ✅ Branch_id обновлен на tbilisi');
      
      // Проверяем результат
      const updatedCar = await sql`
        SELECT 
          c.id,
          c.branch_id,
          b.code as branch_code,
          b.name as branch_name
        FROM cars c
        LEFT JOIN branches b ON b.id = c.branch_id
        WHERE c.id = ${car.id}
      `;
      
      if (updatedCar.length > 0) {
        console.log('\n   ✅ Проверка после обновления:');
        console.log(`      Branch Code: ${updatedCar[0].branch_code}`);
        console.log(`      Branch Name: ${updatedCar[0].branch_name}`);
      }
    } else {
      console.log(`\n   ✅ Branch в БД соответствует новому company_id`);
    }
    
    // 4. Исправление события в БД (company_id)
    console.log('\n📋 4. Исправление company_id в событии');
    console.log('-'.repeat(80));
    
    // Ищем все события за 21.11
    const allEvents = await sql`
      SELECT 
        id,
        ts,
        company_id,
        rentprog_id,
        payload
      FROM events
      WHERE rentprog_id = ${rentprogId}
        AND ts >= '2025-11-21 00:00:00'::timestamptz
        AND ts < '2025-11-22 00:00:00'::timestamptz
      ORDER BY ts DESC
    `;
    
    if (allEvents.length > 0) {
      console.log(`✅ Найдено событий за 21.11.2025: ${allEvents.length}\n`);
      
      // Ищем событие с company_id в payload как массив
      let eventToFix = null;
      for (const event of allEvents) {
        if (event.payload) {
          try {
            const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
            if (payload.company_id && Array.isArray(payload.company_id) && payload.company_id.includes(9247)) {
              eventToFix = event;
              break;
            }
          } catch (err) {
            // Игнорируем ошибки парсинга
          }
        }
      }
      
      if (!eventToFix && allEvents.length > 0) {
        // Берем последнее событие
        eventToFix = allEvents[0];
      }
      
      if (eventToFix) {
        console.log(`✅ Событие найдено: ID ${eventToFix.id}`);
        console.log(`   Время: ${new Date(eventToFix.ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
        console.log(`   Текущий company_id: ${eventToFix.company_id}`);
        console.log(`   Ожидаемый company_id: 9247`);
        
        if (eventToFix.company_id !== 9247) {
          console.log('\n   🔧 Обновляю company_id события...');
          await sql`
            UPDATE events
            SET company_id = 9247
            WHERE id = ${eventToFix.id}
          `;
          console.log('   ✅ Company_id обновлен на 9247');
        } else {
          console.log('   ✅ Company_id уже правильный');
        }
      }
    } else {
      console.log('❌ События не найдены');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Проверка и исправление завершены');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkAndFix();

