#!/usr/bin/env node

/**
 * Поиск диалогов Umnico, где x=y (loaded = total)
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function findXEqualYDialogs() {
  try {
    console.log('\n🔍 Поиск диалогов, где x=y (loaded = total)...\n');
    
    // Ищем диалоги, где loaded = total и оба значения не NULL
    const dialogs = await sql`
      SELECT 
        umnico_conversation_id,
        client_name,
        channel,
        metadata->>'loaded' as loaded,
        metadata->>'total' as total,
        metadata->>'incomplete' as incomplete,
        updated_at
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
        AND metadata->>'loaded' IS NOT NULL
        AND metadata->>'total' IS NOT NULL
        AND (metadata->>'loaded')::int = (metadata->>'total')::int
        AND (metadata->>'total')::int > 0
      ORDER BY updated_at DESC
    `;
    
    console.log(`Найдено диалогов с x=y: ${dialogs.length}\n`);
    
    if (dialogs.length > 0) {
      console.log('='.repeat(80));
      console.log('ID диалога'.padEnd(15) + ' | ' + 
                  'Клиент'.padEnd(20) + ' | ' + 
                  'Канал'.padEnd(10) + ' | ' + 
                  'x/y'.padEnd(10) + ' | ' + 
                  'Неполный');
      console.log('='.repeat(80));
      
      dialogs.forEach((dialog, idx) => {
        const id = dialog.umnico_conversation_id || 'N/A';
        const client = (dialog.client_name || 'Unknown').substring(0, 18);
        const channel = (dialog.channel || 'unknown').substring(0, 8);
        const xy = `${dialog.loaded}/${dialog.total}`;
        const incomplete = dialog.incomplete === 'true' ? '⚠️ Да' : '✅ Нет';
        
        console.log(
          id.padEnd(15) + ' | ' +
          client.padEnd(20) + ' | ' +
          channel.padEnd(10) + ' | ' +
          xy.padEnd(10) + ' | ' +
          incomplete
        );
      });
      
      console.log('='.repeat(80));
      
      // Список только ID для копирования
      console.log('\n📋 Список ID (для копирования):');
      console.log(dialogs.map(d => d.umnico_conversation_id).join(', '));
      
      // Статистика
      const incompleteCount = dialogs.filter(d => d.incomplete === 'true').length;
      console.log(`\n📊 Статистика:`);
      console.log(`   Всего диалогов с x=y: ${dialogs.length}`);
      console.log(`   Помечены как incomplete: ${incompleteCount} (${((incompleteCount/dialogs.length)*100).toFixed(1)}%)`);
      console.log(`   Не помечены как incomplete: ${dialogs.length - incompleteCount} (${(((dialogs.length - incompleteCount)/dialogs.length)*100).toFixed(1)}%)`);
      
    } else {
      console.log('✅ Диалогов с x=y не найдено');
    }
    
    // Дополнительная статистика: сколько всего диалогов с метаданными
    const [totalStats] = await sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN metadata->>'loaded' IS NOT NULL AND metadata->>'total' IS NOT NULL THEN 1 END)::int as with_xy,
        COUNT(CASE WHEN metadata->>'loaded' IS NOT NULL AND metadata->>'total' IS NOT NULL 
                   AND (metadata->>'loaded')::int = (metadata->>'total')::int 
                   AND (metadata->>'total')::int > 0 THEN 1 END)::int as x_equal_y
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
    `;
    
    console.log(`\n📈 Общая статистика:`);
    console.log(`   Всего диалогов Umnico: ${totalStats.total}`);
    console.log(`   С метаданными x/y: ${totalStats.with_xy}`);
    console.log(`   Где x=y: ${totalStats.x_equal_y} (${((totalStats.x_equal_y/totalStats.total)*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

findXEqualYDialogs()
  .then(() => {
    console.log('\n✅ Поиск завершен\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  });

