#!/usr/bin/env node

/**
 * Применение миграций для History Processing System
 * 
 * Запуск: node setup/apply_history_migrations.mjs
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyMigrations() {
  console.log('🚀 Применение миграций History Processing System\n');
  console.log('=' .repeat(60));
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // 1. Применить миграцию 010
    console.log('\n1️⃣ Применение миграции 010_create_history_mappings.sql');
    console.log('   - Создание таблицы history_operation_mappings');
    console.log('   - Добавление history_log в таблицы');
    console.log('   - Создание views');
    
    const migration010 = readFileSync(
      join(__dirname, 'migrations/010_create_history_mappings.sql'),
      'utf-8'
    );
    
    await sql.unsafe(migration010);
    console.log('   ✅ Миграция 010 применена');
    
    // Проверка
    const mappingsTable = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'history_operation_mappings'
    `;
    console.log(`   ✓ Таблица history_operation_mappings: ${mappingsTable[0].count === 1 ? 'создана' : 'ошибка'}`);
    
    const historyLogCars = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.columns 
      WHERE table_name = 'cars' AND column_name = 'history_log'
    `;
    console.log(`   ✓ Поле cars.history_log: ${historyLogCars[0].count === 1 ? 'добавлено' : 'ошибка'}`);
    
    const statsView = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.views 
      WHERE table_name = 'history_processing_stats'
    `;
    console.log(`   ✓ View history_processing_stats: ${statsView[0].count === 1 ? 'создана' : 'ошибка'}`);
    
    // 2. Применить seed 011
    console.log('\n2️⃣ Применение seed 011_seed_history_mappings.sql');
    console.log('   - Базовый маппинг операций');
    
    const seed011 = readFileSync(
      join(__dirname, 'migrations/011_seed_history_mappings.sql'),
      'utf-8'
    );
    
    await sql.unsafe(seed011);
    console.log('   ✅ Seed 011 применён');
    
    // Проверка
    const mappingsCount = await sql`
      SELECT COUNT(*) as count 
      FROM history_operation_mappings
    `;
    console.log(`   ✓ Всего маппингов: ${mappingsCount[0].count}`);
    
    const webhookMappings = await sql`
      SELECT COUNT(*) as count 
      FROM history_operation_mappings 
      WHERE is_webhook_event = TRUE
    `;
    console.log(`   ✓ Вебхук события (skip): ${webhookMappings[0].count}`);
    
    const paymentMappings = await sql`
      SELECT COUNT(*) as count 
      FROM history_operation_mappings 
      WHERE target_table = 'payments'
    `;
    console.log(`   ✓ Маппинги платежей: ${paymentMappings[0].count}`);
    
    // 3. Статистика
    console.log('\n3️⃣ Статистика History Processing');
    
    const historyTotal = await sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE processed = TRUE) as processed,
             COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM history
    `;
    
    if (historyTotal[0].total > 0) {
      console.log(`   • Всего операций в history: ${historyTotal[0].total}`);
      console.log(`   • Обработано: ${historyTotal[0].processed}`);
      console.log(`   • Ожидают: ${historyTotal[0].pending}`);
    } else {
      console.log('   • Таблица history пуста (заполнится при парсинге)');
    }
    
    // Топ операций
    const unknownOps = await sql`
      SELECT * FROM unknown_operations 
      LIMIT 5
    `;
    
    if (unknownOps.length > 0) {
      console.log('\n   🔍 Топ неизвестных операций:');
      unknownOps.forEach((op, idx) => {
        console.log(`      ${idx + 1}. ${op.operation_type} (частота: ${op.frequency})`);
      });
    }
    
    // 4. Итоги
    console.log('\n' + '='.repeat(60));
    console.log('✅ Миграции успешно применены!');
    console.log('\n📋 Следующие шаги:');
    console.log('   1. Деплой TypeScript кода: npm run build && python deploy_fixes_now.py');
    console.log('   2. Импорт n8n workflow: n8n-workflows/history-matcher-processor.json');
    console.log('   3. Проверка API: curl http://46.224.17.15:3000/process-history/stats');
    console.log('   4. Активировать workflow в n8n UI');
    console.log('\n📚 Документация: docs/HISTORY_PROCESSING.md');
    
  } catch (error) {
    console.error('\n❌ Ошибка при применении миграций:');
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запуск
applyMigrations().catch(console.error);

