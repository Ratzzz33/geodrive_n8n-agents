#!/usr/bin/env node
/**
 * Проверка статистики после backfill
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkStats() {
  try {
    const [convs] = await sql`SELECT COUNT(*) as count FROM conversations`;
    const [msgs] = await sql`SELECT COUNT(*) as count FROM messages`;
    const [clients] = await sql`SELECT COUNT(*) as count FROM clients WHERE phone IS NOT NULL`;
    const [refs] = await sql`SELECT COUNT(*) as count FROM external_refs WHERE system = 'umnico'`;
    
    const [recentConvs] = await sql`
      SELECT COUNT(*) as count 
      FROM conversations 
      WHERE last_message_at > NOW() - INTERVAL '7 days'
    `;
    
    const [recentMsgs] = await sql`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE sent_at > NOW() - INTERVAL '7 days'
    `;
    
    console.log('\n📊 Статистика БД после backfill:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Диалоги (всего):        ${convs.count}`);
    console.log(`  Диалоги (последние 7д): ${recentConvs.count}`);
    console.log(`  Сообщения (всего):      ${msgs.count}`);
    console.log(`  Сообщения (последние 7д): ${recentMsgs.count}`);
    console.log(`  Клиенты с телефонами:   ${clients.count}`);
    console.log(`  Связи Umnico:           ${refs.count}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Примеры последних диалогов
    const examples = await sql`
      SELECT 
        c.id,
        c.umnico_conversation_id,
        c.client_id,
        cl.phone,
        cl.name,
        c.last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as msg_count
      FROM conversations c
      LEFT JOIN clients cl ON cl.id = c.client_id
      ORDER BY c.last_message_at DESC
      LIMIT 5
    `;
    
    if (examples.length > 0) {
      console.log('📋 Примеры последних диалогов:');
      examples.forEach((ex, i) => {
        console.log(`\n  ${i + 1}. Umnico ID: ${ex.umnico_conversation_id || 'N/A'}`);
        console.log(`     Клиент: ${ex.phone || 'N/A'} (${ex.name || 'N/A'})`);
        console.log(`     Сообщений: ${ex.msg_count}`);
        console.log(`     Последнее: ${ex.last_message_at ? new Date(ex.last_message_at).toLocaleString('ru-RU') : 'N/A'}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке статистики:', error);
  } finally {
    await sql.end();
  }
}

checkStats();

