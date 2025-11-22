#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkPaymentsTable() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка структуры таблицы payments...\n');

    // Проверить существование таблицы
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'payments'
      ) as exists
    `;

    if (!tableExists[0].exists) {
      console.log('❌ Таблица payments не существует!');
      return;
    }

    console.log('✅ Таблица payments существует\n');

    // Получить структуру таблицы
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'payments'
      ORDER BY ordinal_position
    `;

    console.log('📋 Колонки таблицы payments:\n');
    columns.forEach(col => {
      console.log(`  ${col.column_name}`);
      console.log(`    Тип: ${col.data_type}`);
      console.log(`    Nullable: ${col.is_nullable}`);
      if (col.column_default) {
        console.log(`    Default: ${col.column_default}`);
      }
      console.log('');
    });

    // Проверить последние записи
    const recentPayments = await sql`
      SELECT *
      FROM payments
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log(`\n📊 Последние 5 записей (всего: ${recentPayments.length}):\n`);
    recentPayments.forEach((payment, idx) => {
      console.log(`  [${idx + 1}] ID: ${payment.id}`);
      Object.keys(payment).forEach(key => {
        if (key !== 'id' && payment[key] !== null) {
          const value = typeof payment[key] === 'object' 
            ? JSON.stringify(payment[key]).substring(0, 50) 
            : String(payment[key]).substring(0, 50);
          console.log(`      ${key}: ${value}`);
        }
      });
      console.log('');
    });

    // Подсчитать общее количество
    const count = await sql`
      SELECT COUNT(*) as total FROM payments
    `;

    console.log(`\n📊 Всего записей в payments: ${count[0].total}`);

    // Проверить наличие записей с operation_id из списка
    const operationIds = ['1866420', '1865096', '1864454', '1863796', '1863792'];
    
    const foundPayments = await sql`
      SELECT *
      FROM payments
      WHERE rentprog_id = ANY(${operationIds})
      LIMIT 5
    `;

    if (foundPayments.length > 0) {
      console.log(`\n✅ Найдено ${foundPayments.length} операций из списка в payments:\n`);
      foundPayments.forEach(p => {
        console.log(`  ID: ${p.rentprog_id}`);
        console.log(`    amount: ${p.amount}`);
        console.log(`    description: ${p.description || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('\n❌ Операции из списка не найдены в payments');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkPaymentsTable();
