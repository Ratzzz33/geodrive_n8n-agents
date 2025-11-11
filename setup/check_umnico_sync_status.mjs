#!/usr/bin/env node

/**
 * Проверка статуса синхронизации чатов Umnico
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config();

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
  try {
    console.log('📊 Статус синхронизации чатов Umnico\n');
    console.log('='.repeat(60) + '\n');
    
    // Проверка таблицы umnico_chat_ids
    const idsStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending,
        COUNT(*) FILTER (WHERE metadata->>'error' IS NOT NULL) as errors,
        MAX(last_sync_at) as last_sync
      FROM umnico_chat_ids
    `;
    
    if (idsStats.length === 0 || idsStats[0].total === '0') {
      console.log('⚠️  Таблица umnico_chat_ids пуста');
      console.log('\n💡 Запустите: node setup/collect_umnico_chat_ids.mjs\n');
      return;
    }
    
    const stats = idsStats[0];
    const total = parseInt(stats.total);
    const processed = parseInt(stats.processed);
    const pending = parseInt(stats.pending);
    const errors = parseInt(stats.errors);
    const progress = total > 0 ? ((processed / total) * 100).toFixed(1) : 0;
    
    console.log('📋 ID чатов:');
    console.log(`   Всего собрано: ${total}`);
    console.log(`   Обработано: ${processed} (${progress}%)`);
    console.log(`   Ожидает: ${pending}`);
    console.log(`   Ошибок: ${errors}`);
    console.log(`   Последняя синхронизация: ${stats.last_sync || 'никогда'}\n`);
    
    // Проверка conversations
    const conversationsStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        MAX(last_message_at) as last_message
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
    `;
    
    if (conversationsStats.length > 0 && conversationsStats[0].total !== '0') {
      const convStats = conversationsStats[0];
      console.log('💬 Переписки:');
      console.log(`   Всего чатов: ${convStats.total}`);
      console.log(`   Активных: ${convStats.active}`);
      console.log(`   Закрытых: ${convStats.closed}`);
      console.log(`   Последнее сообщение: ${convStats.last_message || 'нет данных'}\n`);
    }
    
    // Проверка messages
    const messagesStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE direction = 'incoming') as incoming,
        COUNT(*) FILTER (WHERE direction = 'outgoing') as outgoing,
        MIN(sent_at) as first_message,
        MAX(sent_at) as last_message
      FROM messages
      WHERE conversation_id IN (
        SELECT id FROM conversations WHERE umnico_conversation_id IS NOT NULL
      )
    `;
    
    if (messagesStats.length > 0 && messagesStats[0].total !== '0') {
      const msgStats = messagesStats[0];
      console.log('📨 Сообщения:');
      console.log(`   Всего: ${msgStats.total}`);
      console.log(`   Входящих: ${msgStats.incoming}`);
      console.log(`   Исходящих: ${msgStats.outgoing}`);
      console.log(`   Период: ${msgStats.first_message || '?'} — ${msgStats.last_message || '?'}\n`);
    }
    
    // Последние обработанные чаты
    if (processed > 0) {
      console.log('📝 Последние обработанные чаты:\n');
      const recent = await sql`
        SELECT 
          id,
          metadata->>'client_name' as client_name,
          metadata->>'messages_count' as messages_count,
          metadata->>'status' as status,
          last_sync_at
        FROM umnico_chat_ids
        WHERE processed = TRUE
        ORDER BY last_sync_at DESC
        LIMIT 5
      `;
      
      recent.forEach((chat, idx) => {
        console.log(`   ${idx + 1}. ID: ${chat.id}`);
        console.log(`      Клиент: ${chat.client_name || 'Unknown'}`);
        console.log(`      Сообщений: ${chat.messages_count || '0'}`);
        console.log(`      Статус: ${chat.status || 'unknown'}`);
        console.log(`      Синхронизировано: ${chat.last_sync_at || 'unknown'}\n`);
      });
    }
    
    // Ошибки
    if (errors > 0) {
      console.log('⚠️  Чаты с ошибками:\n');
      const errorChats = await sql`
        SELECT 
          id,
          metadata->>'error' as error,
          metadata->>'failed_at' as failed_at
        FROM umnico_chat_ids
        WHERE metadata->>'error' IS NOT NULL
        ORDER BY last_sync_at DESC
        LIMIT 5
      `;
      
      errorChats.forEach((chat, idx) => {
        console.log(`   ${idx + 1}. ID: ${chat.id}`);
        console.log(`      Ошибка: ${chat.error}`);
        console.log(`      Когда: ${chat.failed_at}\n`);
      });
    }
    
    // Рекомендации
    console.log('='.repeat(60) + '\n');
    
    if (pending > 0) {
      console.log('💡 Есть необработанные чаты. Запустите:');
      console.log('   node setup/sync_umnico_conversations.mjs\n');
    }
    
    if (pending === 0 && processed > 0) {
      console.log('✅ Все чаты обработаны!');
      console.log('   Можно запустить Telegram Bridge:\n');
      console.log('   npm start\n');
    }
    
    if (total === 0) {
      console.log('💡 Сначала соберите ID чатов:');
      console.log('   1. node setup/collect_umnico_chat_ids.mjs');
      console.log('   2. Соберите ID через браузер (см. инструкции)');
      console.log('   3. node setup/save_umnico_chat_ids.mjs chat_ids.json\n');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkStatus().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

