#!/usr/bin/env node

/**
 * Проверка что сообщения действительно сохраняются с текстом
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    console.log('🔍 Проверка сохраненных сообщений...\n');
    
    // 1. Общая статистика
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE text IS NOT NULL AND text != '') as with_text,
        COUNT(*) FILTER (WHERE text IS NULL OR text = '') as empty_text,
        COUNT(DISTINCT conversation_id) as conversations_count
      FROM messages
      WHERE conversation_id IN (
        SELECT id FROM conversations WHERE umnico_conversation_id IS NOT NULL
      )
    `;
    
    console.log('📊 Общая статистика сообщений:');
    console.log(`   Всего сообщений: ${stats[0].total}`);
    console.log(`   С текстом: ${stats[0].with_text}`);
    console.log(`   Без текста: ${stats[0].empty_text}`);
    console.log(`   Переписок: ${stats[0].conversations_count}\n`);
    
    // 2. Примеры сообщений с текстом
    const samples = await sql`
      SELECT 
        m.text,
        m.direction,
        m.sent_at,
        c.umnico_conversation_id,
        cl.name as client_name
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      LEFT JOIN clients cl ON m.client_id = cl.id
      WHERE m.text IS NOT NULL 
        AND m.text != ''
        AND c.umnico_conversation_id IS NOT NULL
      ORDER BY m.sent_at DESC
      LIMIT 10
    `;
    
    console.log('📝 Примеры сохраненных сообщений (последние 10):\n');
    samples.forEach((msg, i) => {
      const textPreview = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
      console.log(`${i + 1}. [${msg.direction}] ${msg.client_name || 'Unknown'} (${msg.umnico_conversation_id})`);
      console.log(`   ${new Date(msg.sent_at).toLocaleString('ru-RU')}`);
      console.log(`   "${textPreview}"`);
      console.log('');
    });
    
    // 3. Проверка переписок без сообщений
    const emptyConversations = await sql`
      SELECT 
        c.umnico_conversation_id,
        c.created_at,
        cl.name as client_name
      FROM conversations c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.umnico_conversation_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM messages m WHERE m.conversation_id = c.id
        )
      ORDER BY c.created_at DESC
      LIMIT 10
    `;
    
    if (emptyConversations.length > 0) {
      console.log('⚠️  Переписки без сообщений (последние 10):\n');
      emptyConversations.forEach((conv, i) => {
        console.log(`${i + 1}. ID: ${conv.umnico_conversation_id} | Клиент: ${conv.client_name || 'Unknown'}`);
        console.log(`   Создано: ${new Date(conv.created_at).toLocaleString('ru-RU')}\n`);
      });
    } else {
      console.log('✅ Все переписки имеют сообщения\n');
    }
    
    // 4. Статистика по перепискам
    const convStats = await sql`
      SELECT 
        c.umnico_conversation_id,
        COUNT(m.id) as messages_count,
        COUNT(m.id) FILTER (WHERE m.text IS NOT NULL AND m.text != '') as messages_with_text
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.umnico_conversation_id IS NOT NULL
      GROUP BY c.umnico_conversation_id
      ORDER BY messages_count DESC
      LIMIT 10
    `;
    
    console.log('📊 Топ-10 переписок по количеству сообщений:\n');
    convStats.forEach((conv, i) => {
      console.log(`${i + 1}. ID: ${conv.umnico_conversation_id}`);
      console.log(`   Всего сообщений: ${conv.messages_count}`);
      console.log(`   С текстом: ${conv.messages_with_text}\n`);
    });
    
    // 5. Проверка последних синхронизированных чатов
    const recent = await sql`
      SELECT 
        u.id,
        u.metadata->>'messages_count' as reported_count,
        COUNT(m.id) as actual_count
      FROM umnico_chat_ids u
      LEFT JOIN conversations c ON c.umnico_conversation_id = u.id
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE u.processed = TRUE
        AND u.metadata->>'error' IS NULL
      GROUP BY u.id, u.metadata
      ORDER BY u.last_sync_at DESC
      LIMIT 10
    `;
    
    console.log('🔍 Проверка последних синхронизированных чатов:\n');
    recent.forEach((chat, i) => {
      const reported = parseInt(chat.reported_count || 0);
      const actual = parseInt(chat.actual_count || 0);
      const match = reported === actual ? '✅' : '⚠️';
      console.log(`${match} ID: ${chat.id}`);
      console.log(`   Заявлено сообщений: ${reported}`);
      console.log(`   Реально сохранено: ${actual}`);
      if (reported !== actual) {
        console.log(`   ⚠️  Расхождение: ${Math.abs(reported - actual)}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

verify();

