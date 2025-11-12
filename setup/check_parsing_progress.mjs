#!/usr/bin/env node

/**
 * Проверка прогресса парсинга Umnico диалогов
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'fs';

config();

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  try {
    // 1. Читаем ID из файла
    const fileContent = readFileSync('umnico_chat_ids_full.json', 'utf8');
    const fileData = JSON.parse(fileContent);
    const idsFromFile = fileData.ids || fileData || [];
    
    // 2. Получаем статистику из БД
    const totalInFile = idsFromFile.length;
    
    const conversationsStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN metadata->>'incomplete' = 'true' THEN 1 END) as incomplete,
        COUNT(CASE WHEN metadata->>'incomplete' = 'false' OR metadata->>'incomplete' IS NULL THEN 1 END) as complete
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
    `;
    
    const messagesStats = await sql`
      SELECT COUNT(*) as total_messages
      FROM messages
    `;
    
    const clientsStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as with_phone,
        COUNT(CASE WHEN telegram_username IS NOT NULL THEN 1 END) as with_telegram
      FROM clients
    `;
    
    const recentConversations = await sql`
      SELECT 
        umnico_conversation_id,
        client_name,
        channel,
        metadata->>'incomplete' as incomplete,
        metadata->>'loaded' as loaded,
        metadata->>'total' as total,
        updated_at
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 СТАТИСТИКА ПАРСИНГА UMNICO');
    console.log('='.repeat(60));
    console.log(`\n📁 ID в файле: ${totalInFile}`);
    console.log(`\n💬 Диалоги в БД:`);
    console.log(`   Всего: ${conversationsStats[0].total}`);
    console.log(`   ✅ Полных: ${conversationsStats[0].complete}`);
    console.log(`   ⚠️  Неполных: ${conversationsStats[0].incomplete}`);
    console.log(`\n📨 Сообщений в БД: ${messagesStats[0].total_messages}`);
    console.log(`\n👥 Клиенты:`);
    console.log(`   Всего: ${clientsStats[0].total}`);
    console.log(`   📱 С телефоном: ${clientsStats[0].with_phone}`);
    console.log(`   💬 С Telegram: ${clientsStats[0].with_telegram}`);
    
    if (recentConversations.length > 0) {
      console.log(`\n🕐 Последние 10 обработанных диалогов:`);
      recentConversations.forEach((conv, idx) => {
        const incomplete = conv.incomplete === 'true' ? ' ⚠️' : ' ✅';
        const loaded = conv.loaded || '?';
        const total = conv.total || '?';
        console.log(`   ${idx + 1}. ${conv.umnico_conversation_id} - ${conv.client_name || 'Unknown'} (${conv.channel})${incomplete} [${loaded}/${total}]`);
      });
    }
    
    const progress = totalInFile > 0 
      ? ((conversationsStats[0].total / totalInFile) * 100).toFixed(1)
      : 0;
    
    console.log(`\n📈 Прогресс: ${progress}% (${conversationsStats[0].total}/${totalInFile})`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkProgress()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });

