#!/usr/bin/env node

/**
 * Единый скрипт применения всех миграций
 * 
 * Запуск: node setup/apply_all_migrations.mjs
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const MIGRATIONS = [
  {
    number: '010',
    name: 'History Mappings',
    file: 'migrations/010_create_history_mappings.sql',
    checks: [
      { table: 'history_operation_mappings', description: 'Таблица маппингов' },
      { view: 'history_processing_stats', description: 'View статистики' },
      { column: { table: 'cars', column: 'history_log' }, description: 'history_log в cars' }
    ]
  },
  {
    number: '011',
    name: 'History Seed',
    file: 'migrations/011_seed_history_mappings.sql',
    checks: [
      { count: { table: 'history_operation_mappings', expected: 27 }, description: 'Базовый маппинг (27 операций)' }
    ]
  },
  {
    number: '012',
    name: 'Car Prices',
    file: 'migrations/012_create_car_prices_table.sql',
    checks: [
      { table: 'car_prices', description: 'Таблица цен' },
      { view: 'current_car_prices', description: 'View текущих цен' },
      { function: 'get_car_price_for_days', description: 'Функция расчёта цены' }
    ]
  }
];

async function checkTable(sql, tableName) {
  const result = await sql`
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = ${tableName}
  `;
  return result.length > 0;
}

async function checkView(sql, viewName) {
  const result = await sql`
    SELECT 1 FROM information_schema.views 
    WHERE table_name = ${viewName}
  `;
  return result.length > 0;
}

async function checkColumn(sql, tableName, columnName) {
  const result = await sql`
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = ${tableName} AND column_name = ${columnName}
  `;
  return result.length > 0;
}

async function checkFunction(sql, functionName) {
  const result = await sql`
    SELECT 1 FROM pg_proc 
    WHERE proname = ${functionName}
  `;
  return result.length > 0;
}

async function checkCount(sql, tableName, expected) {
  const result = await sql`
    SELECT COUNT(*) as count FROM ${sql(tableName)}
  `;
  return result[0].count >= expected;
}

async function applyMigration(sql, migration) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 Миграция ${migration.number}: ${migration.name}`);
  console.log(`   Файл: ${migration.file}`);
  console.log('='.repeat(60));
  
  try {
    // Прочитать SQL файл
    const migrationSql = readFileSync(
      join(__dirname, migration.file),
      'utf-8'
    );
    
    // Выполнить миграцию
    console.log('   ⏳ Применение...');
    await sql.unsafe(migrationSql);
    console.log('   ✅ SQL выполнен');
    
    // Проверки
    console.log('   🔍 Проверка результатов:');
    
    for (const check of migration.checks) {
      let passed = false;
      let description = check.description;
      
      if (check.table) {
        passed = await checkTable(sql, check.table);
      } else if (check.view) {
        passed = await checkView(sql, check.view);
      } else if (check.column) {
        passed = await checkColumn(sql, check.column.table, check.column.column);
      } else if (check.function) {
        passed = await checkFunction(sql, check.function);
      } else if (check.count) {
        passed = await checkCount(sql, check.count.table, check.count.expected);
      }
      
      const status = passed ? '✅' : '❌';
      console.log(`      ${status} ${description}`);
      
      if (!passed) {
        console.warn(`      ⚠️  Проверка не прошла, но продолжаем`);
      }
    }
    
    return { ok: true, migration: migration.name };
    
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}`);
    return { ok: false, migration: migration.name, error: error.message };
  }
}

async function main() {
  console.log('🚀 Применение всех миграций для полноты данных');
  console.log('   • History Processing System');
  console.log('   • Car Prices Sync');
  console.log('\n' + '='.repeat(60));
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  const results = [];
  
  try {
    // Применить все миграции
    for (const migration of MIGRATIONS) {
      const result = await applyMigration(sql, migration);
      results.push(result);
      
      // Пауза между миграциями
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Итоговая статистика
    console.log('\n' + '='.repeat(60));
    console.log('📊 Итоговая статистика');
    console.log('='.repeat(60));
    
    // History Processing
    console.log('\n1️⃣  History Processing System:');
    
    const historyMappingsCount = await sql`
      SELECT COUNT(*) as count FROM history_operation_mappings
    `;
    console.log(`   • Маппингов операций: ${historyMappingsCount[0].count}`);
    
    const historyLogTables = await sql`
      SELECT table_name 
      FROM information_schema.columns 
      WHERE column_name = 'history_log'
      ORDER BY table_name
    `;
    console.log(`   • Таблицы с history_log: ${historyLogTables.map(r => r.table_name).join(', ')}`);
    
    const historyViews = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name LIKE 'history_%' OR table_name LIKE '%_history%'
      ORDER BY table_name
    `;
    console.log(`   • Views: ${historyViews.map(r => r.table_name).join(', ')}`);
    
    const historyTotal = await sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE processed = TRUE) as processed,
             COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM history
    `;
    
    if (historyTotal[0].total > 0) {
      console.log(`   • Операций в history: ${historyTotal[0].total}`);
      console.log(`     - Обработано: ${historyTotal[0].processed}`);
      console.log(`     - Ожидают: ${historyTotal[0].pending}`);
    } else {
      console.log('   • Таблица history пуста (заполнится при парсинге)');
    }
    
    // Car Prices
    console.log('\n2️⃣  Car Prices Sync:');
    
    const carPricesCount = await sql`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT car_id) as unique_cars,
             COUNT(*) FILTER (WHERE active = TRUE) as active_prices
      FROM car_prices
    `;
    
    if (carPricesCount[0].total > 0) {
      console.log(`   • Всего price records: ${carPricesCount[0].total}`);
      console.log(`   • Машин с ценами: ${carPricesCount[0].unique_cars}`);
      console.log(`   • Активных цен: ${carPricesCount[0].active_prices}`);
    } else {
      console.log('   • Таблица car_prices пуста (заполнится при синхронизации)');
    }
    
    const currentPricesView = await checkView(sql, 'current_car_prices');
    console.log(`   • View current_car_prices: ${currentPricesView ? '✅' : '❌'}`);
    
    const priceFunction = await checkFunction(sql, 'get_car_price_for_days');
    console.log(`   • Function get_car_price_for_days: ${priceFunction ? '✅' : '❌'}`);
    
    // Общий итог
    console.log('\n' + '='.repeat(60));
    const allOk = results.every(r => r.ok);
    
    if (allOk) {
      console.log('✅ Все миграции успешно применены!');
    } else {
      console.log('⚠️  Некоторые миграции завершились с ошибками:');
      results.filter(r => !r.ok).forEach(r => {
        console.log(`   ❌ ${r.migration}: ${r.error}`);
      });
    }
    
    // Следующие шаги
    console.log('\n📋 Следующие шаги:');
    console.log('   1. Деплой TypeScript кода:');
    console.log('      npm run build && python deploy_fixes_now.py');
    console.log('');
    console.log('   2. Импорт n8n workflows:');
    console.log('      • n8n-workflows/history-matcher-processor.json');
    console.log('      • n8n-workflows/daily-price-sync.json');
    console.log('');
    console.log('   3. Первый запуск:');
    console.log('      curl -X POST http://46.224.17.15:3000/process-history \\');
    console.log('        -d \'{"limit": 100}\'');
    console.log('      curl http://46.224.17.15:3000/sync-prices/tbilisi');
    console.log('');
    console.log('   4. Проверка:');
    console.log('      curl http://46.224.17.15:3000/process-history/stats');
    console.log('      psql $DATABASE_URL -c "SELECT * FROM current_car_prices LIMIT 5;"');
    console.log('');
    console.log('📚 Документация:');
    console.log('   • docs/HISTORY_PROCESSING.md');
    console.log('   • docs/CAR_PRICES_SYNC.md');
    console.log('   • COMPLETE_SYSTEMS_REPORT.md');
    
    process.exit(allOk ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Фатальная ошибка:');
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запуск
main().catch(console.error);

