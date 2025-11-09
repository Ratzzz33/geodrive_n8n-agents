#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function addCashFields() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Добавление полей cash в rentprog_employees\n');
  
  try {
    // Добавить поля для касс по валютам
    await sql.unsafe(`
      ALTER TABLE rentprog_employees 
        ADD COLUMN IF NOT EXISTS cash_gel NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cash_usd NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cash_eur NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cash_rub NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cash_last_synced TIMESTAMPTZ;
    `);
    
    console.log('✅ Поля добавлены:');
    console.log('   - cash_gel (NUMERIC)');
    console.log('   - cash_usd (NUMERIC)');
    console.log('   - cash_eur (NUMERIC)');
    console.log('   - cash_rub (NUMERIC)');
    console.log('   - cash_last_synced (TIMESTAMPTZ)\n');
    
    // Создать индекс для cash_last_synced
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_rentprog_employees_cash_synced 
        ON rentprog_employees(cash_last_synced);
    `);
    
    console.log('✅ Индекс создан: idx_rentprog_employees_cash_synced\n');
    
    // Проверка структуры
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'rentprog_employees'
        AND column_name LIKE 'cash%'
      ORDER BY ordinal_position
    `;
    
    console.log('📊 Структура cash полей:');
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'NULL'})`);
    });
    console.log();
    
  } finally {
    await sql.end();
  }
}

addCashFields();

