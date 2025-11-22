#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// ID операций из списка пользователя
const operationIds = [
  '1866420', '1865096', '1864454', '1863796', '1863792', '1862116', '1862110',
  '1860907', '1860328', '1860104', '1859821', '1859639', '1859596', '1859032',
  '1859025', '1858494', '1858491', '1858199', '1857853', '1857851', '1857820',
  '1856987', '1856985', '1856961', '1856959', '1856746', '1856739', '1856730',
  '1856021'
];

async function checkOperations() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка операций касс в БД...\n');

    // Проверяем в таблице history
    const foundInHistory = await sql`
      SELECT 
        operation_id,
        branch,
        operation_type,
        description,
        created_at,
        processed,
        error_code
      FROM history
      WHERE operation_id = ANY(${operationIds})
      ORDER BY operation_id DESC
    `;

    console.log(`📋 Найдено в таблице history: ${foundInHistory.length} из ${operationIds.length}\n`);

    if (foundInHistory.length > 0) {
      console.log('Найденные операции:\n');
      foundInHistory.forEach((op, idx) => {
        console.log(`  [${idx + 1}] ID: ${op.operation_id}`);
        console.log(`      Branch: ${op.branch}`);
        console.log(`      Type: ${op.operation_type}`);
        console.log(`      Description: ${op.description.substring(0, 80)}${op.description.length > 80 ? '...' : ''}`);
        console.log(`      Created: ${op.created_at}`);
        console.log(`      Processed: ${op.processed}`);
        if (op.error_code) {
          console.log(`      Error: ${op.error_code}`);
        }
        console.log('');
      });
    }

    // Найти отсутствующие
    const foundIds = new Set(foundInHistory.map(op => op.operation_id));
    const missing = operationIds.filter(id => !foundIds.has(id));

    if (missing.length > 0) {
      console.log(`\n❌ Отсутствуют в БД (${missing.length}):\n`);
      missing.forEach((id, idx) => {
        console.log(`  [${idx + 1}] ID: ${id}`);
      });
    }

    // Статистика по типам операций
    if (foundInHistory.length > 0) {
      const byType = {};
      foundInHistory.forEach(op => {
        byType[op.operation_type] = (byType[op.operation_type] || 0) + 1;
      });

      console.log('\n📊 Статистика по типам операций:');
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

      // Статистика по филиалам
      const byBranch = {};
      foundInHistory.forEach(op => {
        byBranch[op.branch] = (byBranch[op.branch] || 0) + 1;
      });

      console.log('\n📍 По филиалам:');
      Object.entries(byBranch).forEach(([branch, count]) => {
        console.log(`   ${branch}: ${count}`);
      });

      // Статистика обработки
      const processed = foundInHistory.filter(op => op.processed).length;
      const unprocessed = foundInHistory.filter(op => !op.processed).length;
      const withErrors = foundInHistory.filter(op => op.error_code).length;

      console.log('\n⚙️ Обработка:');
      console.log(`   Обработано: ${processed}`);
      console.log(`   Не обработано: ${unprocessed}`);
      if (withErrors > 0) {
        console.log(`   С ошибками: ${withErrors}`);
      }
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 ИТОГО:\n');
    console.log(`Всего проверено операций: ${operationIds.length}`);
    console.log(`Найдено в БД: ${foundInHistory.length} (${(foundInHistory.length / operationIds.length * 100).toFixed(1)}%)`);
    console.log(`Отсутствует: ${missing.length} (${(missing.length / operationIds.length * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkOperations();

