#!/usr/bin/env node
/**
 * Проверка: какие колонки использует workflow и какие есть в БД
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔍 Проверяю колонки в таблице payments...\n');

// Колонки, которые использует workflow
const workflowColumns = [
  'branch',
  'payment_id',
  'sum',
  'cash',
  'cashless',
  'group',
  'subgroup',
  'description',
  'car_id',
  'booking_id',
  'client_id',
  'user_id',
  'created_at',
  'raw_data'
];

try {
  // Получить все колонки таблицы payments
  const dbColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'payments'
    ORDER BY ordinal_position;
  `;
  
  const dbColumnNames = dbColumns.map(c => c.column_name);
  
  console.log('📋 Колонки в БД (payments):');
  dbColumns.forEach(col => {
    console.log(`   - ${col.column_name}: ${col.data_type}`);
  });
  
  console.log('\n\n🔍 Сравнение с workflow:\n');
  console.log('Workflow использует:         | В БД есть:');
  console.log('─'.repeat(60));
  
  const missing = [];
  workflowColumns.forEach(wCol => {
    const exists = dbColumnNames.includes(wCol);
    const status = exists ? '✅' : '❌';
    const mapping = getMappingSuggestion(wCol, dbColumnNames);
    console.log(`${status} ${wCol.padEnd(25)} | ${mapping}`);
    if (!exists) missing.push(wCol);
  });
  
  if (missing.length > 0) {
    console.log('\n\n⚠️  Отсутствующие колонки:', missing.join(', '));
    console.log('\n💡 Рекомендации:');
    console.log('   1. Добавить недостающие колонки в БД, ИЛИ');
    console.log('   2. Изменить SQL в workflow для маппинга колонок\n');
    console.log('📝 Предлагаемый маппинг для workflow:');
    console.log('   payment_id → rp_payment_id');
    console.log('   sum → amount');
    console.log('   cash → (часть payment_method)');
    console.log('   cashless → (часть payment_method)');
    console.log('   group → payment_type');
    console.log('   subgroup → payment_subgroup');
    console.log('   car_id → rp_car_id');
    console.log('   client_id → rp_client_id');
    console.log('   user_id → rp_user_id');
  } else {
    console.log('\n✅ Все колонки присутствуют!');
  }
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

function getMappingSuggestion(wCol, dbCols) {
  const mappings = {
    'branch': 'branch ✅',
    'payment_id': 'rp_payment_id (нужен маппинг)',
    'sum': 'amount (нужен маппинг)',
    'cash': 'нет (часть payment_method)',
    'cashless': 'нет (часть payment_method)',
    'group': 'payment_type (нужен маппинг)',
    'subgroup': 'payment_subgroup (нужен маппинг)',
    'description': 'description ✅',
    'car_id': 'rp_car_id (нужен маппинг)',
    'booking_id': 'booking_id ✅',
    'client_id': 'rp_client_id (нужен маппинг)',
    'user_id': 'rp_user_id (нужен маппинг)',
    'created_at': 'created_at ✅',
    'raw_data': 'raw_data ✅'
  };
  
  return mappings[wCol] || (dbCols.includes(wCol) ? wCol + ' ✅' : 'отсутствует');
}

