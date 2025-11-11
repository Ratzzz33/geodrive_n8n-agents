#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkSuccessful() {
  try {
    // Успешно обработанные чаты
    const successful = await sql`
      SELECT 
        id, 
        metadata->>'client_name' as client,
        metadata->>'messages_count' as msgs,
        metadata->>'conversation_id' as conv_id,
        last_sync_at
      FROM umnico_chat_ids 
      WHERE processed = TRUE 
        AND metadata->>'error' IS NULL
      ORDER BY last_sync_at DESC 
      LIMIT 10
    `;
    
    console.log('✅ Успешно обработанные чаты:\n');
    successful.forEach((chat, i) => {
      console.log(`${i + 1}. ID: ${chat.id}`);
      console.log(`   Клиент: ${chat.client || 'Unknown'}`);
      console.log(`   Сообщений: ${chat.msgs || '0'}`);
      console.log(`   Conversation ID: ${chat.conv_id || 'N/A'}`);
      console.log(`   Синхронизировано: ${chat.last_sync_at}\n`);
    });
    
    // Чаты с ошибками
    const errors = await sql`
      SELECT 
        id,
        metadata->>'error' as error,
        last_sync_at
      FROM umnico_chat_ids
      WHERE processed = TRUE
        AND metadata->>'error' IS NOT NULL
      ORDER BY last_sync_at DESC
      LIMIT 10
    `;
    
    console.log('\n❌ Чаты с ошибками:\n');
    errors.forEach((chat, i) => {
      console.log(`${i + 1}. ID: ${chat.id}`);
      console.log(`   Ошибка: ${chat.error}`);
      console.log(`   Когда: ${chat.last_sync_at}\n`);
    });
    
    // Статистика
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE processed = TRUE AND metadata->>'error' IS NULL) as successful,
        COUNT(*) FILTER (WHERE processed = TRUE AND metadata->>'error' IS NOT NULL) as errors,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log('\n📊 Статистика:');
    console.log(`   Успешно: ${stats[0].successful}`);
    console.log(`   Ошибок: ${stats[0].errors}`);
    console.log(`   Ожидает: ${stats[0].pending}\n`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkSuccessful();

