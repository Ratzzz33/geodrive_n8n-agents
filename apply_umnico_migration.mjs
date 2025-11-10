#!/usr/bin/env node
/**
 * Применить миграцию для оптимизации Umnico
 * Добавляет last_message_preview в conversations
 */

import postgres from 'postgres';
import fs from 'fs';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('\n📋 Применение миграции Umnico optimization...\n');

    // Читаем миграцию
    const migration = fs.readFileSync('sql/conversations_optimization.sql', 'utf-8');
    
    // Разбиваем на отдельные SQL команды
    const statements = migration.split(';').filter(s => s.trim());
    
    let success = 0;
    let skipped = 0;
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      
      try {
        await sql.unsafe(trimmed);
        console.log(`✅ Выполнено: ${trimmed.substring(0, 60)}...`);
        success++;
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⏭️  Пропущено (уже существует): ${trimmed.substring(0, 60)}...`);
          skipped++;
        } else {
          throw error;
        }
      }
    }
    
    console.log(`\n✅ Миграция применена!`);
    console.log(`   Выполнено: ${success}`);
    console.log(`   Пропущено: ${skipped}\n`);
    
    // Проверяем результат
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      AND column_name IN ('last_message_preview', 'last_message_at')
      ORDER BY column_name
    `;
    
    console.log('📊 Структура таблицы conversations:');
    result.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    // Проверяем индекс
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'conversations'
      AND indexname = 'idx_conversations_recent'
    `;
    
    if (indexes.length > 0) {
      console.log('\n✅ Индекс idx_conversations_recent создан');
    } else {
      console.log('\n⚠️  Индекс idx_conversations_recent не найден');
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка применения миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

