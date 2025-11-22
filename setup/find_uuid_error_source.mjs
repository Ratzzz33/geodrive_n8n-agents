#!/usr/bin/env node
/**
 * Поиск источника ошибки UUID "47192"
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function findUUIDError() {
  console.log('\n🔍 Поиск источника ошибки UUID "47192"\n');
  console.log('='.repeat(80));

  try {
    // Проверяем события с ошибкой UUID
    const uuidErrors = await sql`
      SELECT id, ts, event_name, type, rentprog_id, payload, reason
      FROM events
      WHERE processed = true AND ok = false 
        AND reason LIKE '%47192%'
      ORDER BY ts DESC
      LIMIT 3
    `;

    console.log(`Найдено ${uuidErrors.length} событий с ошибкой UUID\n`);

    for (const e of uuidErrors) {
      console.log(`\n📋 Событие ${e.id} (${e.event_name || e.type}):`);
      const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
      
      console.log(`   Payload keys: ${Object.keys(payload).join(', ')}`);
      
      // Ищем все числовые значения
      for (const [key, value] of Object.entries(payload)) {
        if (String(value) === '47192' || (Array.isArray(value) && value.includes('47192'))) {
          console.log(`   ⚠️  Найдено "47192" в поле "${key}": ${JSON.stringify(value)}`);
        }
        // Проверяем числовые ID которые могут быть ошибочно использованы как UUID
        if (typeof value === 'number' && value > 10000 && value < 100000) {
          console.log(`   💡 Числовой ID в "${key}": ${value} (может быть проблемой если используется как UUID)`);
        }
      }
      
      // Проверяем external_refs на наличие 47192
      const refs = await sql`
        SELECT entity_type, entity_id, system, external_id
        FROM external_refs
        WHERE external_id = '47192'
        LIMIT 5
      `;
      
      if (refs.length > 0) {
        console.log(`   📌 Найдено в external_refs:`);
        for (const ref of refs) {
          console.log(`      ${ref.entity_type}: ${ref.entity_id} (system: ${ref.system})`);
        }
      }
    }

    // Проверяем таблицы на наличие 47192
    console.log('\n📋 Проверка таблиц на наличие "47192":\n');
    
    // Проверяем employees
    const employees = await sql`
      SELECT id, name, rentprog_id
      FROM employees
      WHERE rentprog_id::text = '47192' OR id::text LIKE '%47192%'
      LIMIT 5
    `;
    
    if (employees.length > 0) {
      console.log(`   Employees: ${employees.length} записей`);
      for (const emp of employees) {
        console.log(`      ${emp.name} (rentprog_id: ${emp.rentprog_id}, UUID: ${emp.id})`);
      }
    }

    // Проверяем rentprog_employees
    const rpEmployees = await sql`
      SELECT id, name, rentprog_id
      FROM rentprog_employees
      WHERE rentprog_id::text = '47192'
      LIMIT 5
    `;
    
    if (rpEmployees.length > 0) {
      console.log(`   RentProg Employees: ${rpEmployees.length} записей`);
      for (const emp of rpEmployees) {
        console.log(`      ${emp.name} (rentprog_id: ${emp.rentprog_id}, UUID: ${emp.id})`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Проверка завершена\n');

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

findUUIDError().catch(console.error);

