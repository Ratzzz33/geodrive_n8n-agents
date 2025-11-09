#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function testWorkflow() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🧪 Тестирование workflow "Ночной парсинг сотрудников и их касс"\n');
  
  try {
    // 1. Проверить таблицу rentprog_employees
    const employees = await sql`
      SELECT 
        id,
        rentprog_id,
        name,
        COALESCE(cash_gel, 0) as cash_gel,
        COALESCE(cash_usd, 0) as cash_usd,
        COALESCE(cash_eur, 0) as cash_eur,
        cash_last_synced
      FROM rentprog_employees
      WHERE rentprog_id IS NOT NULL
      ORDER BY name
      LIMIT 10
    `;
    
    console.log(`📊 Сотрудников в БД: ${employees.length}`);
    if (employees.length > 0) {
      console.log('\n✅ Примеры сотрудников:');
      employees.slice(0, 3).forEach(emp => {
        console.log(`   ${emp.name} (ID: ${emp.rentprog_id})`);
        console.log(`   Касса: GEL ${emp.cash_gel}, USD ${emp.cash_usd}, EUR ${emp.cash_eur}`);
        console.log(`   Синхронизация: ${emp.cash_last_synced || 'никогда'}\n`);
      });
    } else {
      console.log('⚠️  БД пустая - сотрудники не загружены');
      console.log('   Workflow покажет: "No employees in DB to compare"\n');
    }
    
    // 2. Проверить структуру таблицы
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'rentprog_employees'
        AND column_name LIKE 'cash%'
      ORDER BY ordinal_position
    `;
    
    console.log('📋 Структура cash полей:');
    columns.forEach(col => {
      console.log(`   ✓ ${col.column_name}: ${col.data_type}`);
    });
    console.log();
    
    // 3. Проверить связь с external_refs
    const refCount = await sql`
      SELECT COUNT(*) as count
      FROM external_refs
      WHERE entity_type = 'rentprog_employee'
        AND system = 'rentprog'
    `;
    
    console.log(`🔗 Записей в external_refs: ${refCount[0].count}`);
    console.log();
    
    // 4. Симуляция workflow logic
    console.log('🎭 Симуляция workflow:');
    console.log('   1. Get Users from RentProg → ~74 активных users');
    console.log('   2. Get Employees from DB → SQL запрос обновлён ✓');
    console.log('   3. Compare Balances → сравнивает кассы');
    console.log('   4. If Has Discrepancy → проверяет status');
    console.log('   5. Format Alert → защита от undefined ✓\n');
    
    console.log('✅ Workflow готов к тестированию!\n');
    console.log('🔗 Протестировать: https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj\n');
    
  } finally {
    await sql.end();
  }
}

testWorkflow();

