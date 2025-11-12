#!/usr/bin/env node

/**
 * Проверка прогресса сохранения 90 диалогов
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config();

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  try {
    console.log('\n📊 Проверка прогресса сохранения 90 диалогов...\n');
    
    // Читаем список ID
    const { readFileSync } = await import('fs');
    const fileContent = readFileSync('dialog_ids_list.txt', 'utf8');
    const idsMatch = fileContent.match(/📋 Список ID:\s*\n([\d,\s]+)/);
    const dialogIds = idsMatch 
      ? idsMatch[1].split(',').map(id => id.trim()).filter(Boolean)
      : [];
    
    console.log(`📋 Всего ID для обработки: ${dialogIds.length}\n`);
    
    // Проверяем, сколько уже в БД
    const placeholders = dialogIds.map((_, i) => `$${i + 1}`).join(',');
    const existing = await sql`
      SELECT umnico_conversation_id, channel, metadata
      FROM conversations
      WHERE umnico_conversation_id = ANY(${dialogIds})
    `;
    
    const existingIds = new Set(existing.map(c => c.umnico_conversation_id));
    const missingIds = dialogIds.filter(id => !existingIds.has(id));
    
    console.log(`✅ Найдено в БД: ${existing.length}/${dialogIds.length}`);
    console.log(`❌ Отсутствует в БД: ${missingIds.length}`);
    
    if (missingIds.length > 0 && missingIds.length <= 10) {
      console.log(`\n📋 Отсутствующие ID: ${missingIds.join(', ')}`);
    } else if (missingIds.length > 10) {
      console.log(`\n📋 Первые 10 отсутствующих ID: ${missingIds.slice(0, 10).join(', ')}...`);
    }
    
    // Статистика по сообщениям
    const messageStats = await sql`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT conversation_id) as conversations_with_messages
      FROM messages
      WHERE conversation_id IN (
        SELECT id FROM conversations WHERE umnico_conversation_id = ANY(${dialogIds})
      )
    `;
    
    console.log(`\n✉️  Сообщений в БД для этих диалогов: ${messageStats[0].total_messages}`);
    console.log(`📊 Диалогов с сообщениями: ${messageStats[0].conversations_with_messages}`);
    
    // Статистика по incomplete
    const incompleteStats = await sql`
      SELECT COUNT(*) as incomplete_count
      FROM conversations
      WHERE umnico_conversation_id = ANY(${dialogIds})
        AND metadata->>'incomplete' = 'true'
    `;
    
    console.log(`⚠️  Диалогов с incomplete=true: ${incompleteStats[0].incomplete_count}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkProgress();

