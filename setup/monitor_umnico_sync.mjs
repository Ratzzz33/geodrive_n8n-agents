#!/usr/bin/env node

/**
 * Мониторинг прогресса синхронизации Umnico в реальном времени
 * 
 * Использование:
 * node setup/monitor_umnico_sync.mjs
 * 
 * Обновляет статистику каждые 5 секунд
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const UPDATE_INTERVAL = 5000; // 5 секунд

function clearScreen() {
  process.stdout.write('\x1B[2J\x1B[0f');
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}ч ${minutes % 60}м ${seconds % 60}с`;
  } else if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  } else {
    return `${seconds}с`;
  }
}

async function getStats() {
  try {
    const [idsStats, convStats, msgStats, recent] = await Promise.all([
      // Статистика ID чатов
      sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE processed = TRUE) as processed,
          COUNT(*) FILTER (WHERE processed = FALSE) as pending,
          COUNT(*) FILTER (WHERE processed = TRUE AND metadata->>'error' IS NOT NULL) as errors,
          MAX(last_sync_at) as last_sync
        FROM umnico_chat_ids
      `,
      
      // Статистика переписок
      sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'closed') as closed,
          MAX(last_message_at) as last_message
        FROM conversations
        WHERE umnico_conversation_id IS NOT NULL
      `,
      
      // Статистика сообщений
      sql`
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
      `,
      
      // Последние обработанные
      sql`
        SELECT 
          id,
          metadata->>'client_name' as client,
          metadata->>'messages_count' as msgs,
          last_sync_at
        FROM umnico_chat_ids
        WHERE processed = TRUE
        ORDER BY last_sync_at DESC
        LIMIT 5
      `
    ]);
    
    return {
      ids: idsStats[0],
      conversations: convStats[0],
      messages: msgStats[0],
      recent: recent
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error.message);
    return null;
  }
}

function displayStats(stats, startTime) {
  if (!stats) {
    console.log('❌ Не удалось получить статистику');
    return;
  }
  
  const elapsed = Date.now() - startTime;
  const progress = stats.ids.total > 0 ? ((parseInt(stats.ids.processed) / parseInt(stats.ids.total)) * 100).toFixed(1) : 0;
  const rate = parseInt(stats.ids.processed) > 0 ? (parseInt(stats.ids.processed) / (elapsed / 1000 / 60)).toFixed(1) : 0;
  const remaining = parseInt(stats.ids.pending);
  const estimatedTime = remaining > 0 && rate > 0 ? formatTime((remaining / parseFloat(rate)) * 60 * 1000) : 'N/A';
  
  clearScreen();
  
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(20) + '📊 Мониторинг синхронизации Umnico' + ' '.repeat(15) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');
  console.log('║ ID чатов:' + ' '.repeat(59) + '║');
  console.log(`║   Всего собрано:     ${String(stats.ids.total).padStart(6)}` + ' '.repeat(40) + '║');
  console.log(`║   Обработано:       ${String(stats.ids.processed).padStart(6)} (${String(progress).padStart(5)}%)` + ' '.repeat(35) + '║');
  console.log(`║   Осталось:         ${String(stats.ids.pending).padStart(6)}` + ' '.repeat(40) + '║');
  console.log(`║   Ошибок:           ${String(stats.ids.errors || 0).padStart(6)}` + ' '.repeat(40) + '║');
  console.log('║' + ' '.repeat(68) + '║');
  console.log('║ Переписки:' + ' '.repeat(58) + '║');
  console.log(`║   Всего чатов:      ${String(stats.conversations.total || 0).padStart(6)}` + ' '.repeat(40) + '║');
  console.log(`║   Активных:         ${String(stats.conversations.active || 0).padStart(6)}` + ' '.repeat(40) + '║');
  console.log('║' + ' '.repeat(68) + '║');
  console.log('║ Сообщения:' + ' '.repeat(58) + '║');
  console.log(`║   Всего:            ${String(stats.messages.total || 0).padStart(6)}` + ' '.repeat(40) + '║');
  console.log(`║   Входящих:         ${String(stats.messages.incoming || 0).padStart(6)}` + ' '.repeat(40) + '║');
  console.log(`║   Исходящих:        ${String(stats.messages.outgoing || 0).padStart(6)}` + ' '.repeat(40) + '║');
  console.log('║' + ' '.repeat(68) + '║');
  console.log('║ Прогресс:' + ' '.repeat(58) + '║');
  console.log(`║   Время работы:     ${formatTime(elapsed).padEnd(15)}` + ' '.repeat(43) + '║');
  console.log(`║   Скорость:         ~${String(rate).padStart(5)} чатов/мин` + ' '.repeat(38) + '║');
  console.log(`║   Осталось времени: ${estimatedTime.padEnd(15)}` + ' '.repeat(43) + '║');
  console.log(`║   Последняя синхр:  ${stats.ids.last_sync ? new Date(stats.ids.last_sync).toLocaleTimeString('ru-RU') : 'N/A'}`.padEnd(68) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');
  console.log('║ Последние обработанные чаты:' + ' '.repeat(38) + '║');
  
  if (stats.recent.length > 0) {
    stats.recent.forEach((chat, i) => {
      const time = chat.last_sync_at ? new Date(chat.last_sync_at).toLocaleTimeString('ru-RU') : 'N/A';
      const line = `║   ${i + 1}. ID: ${chat.id} | ${(chat.msgs || '0').padStart(3)} сообщ. | ${time}`;
      console.log(line.padEnd(69) + '║');
    });
  } else {
    console.log('║   Нет данных' + ' '.repeat(55) + '║');
  }
  
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('\nНажмите Ctrl+C для выхода\n');
}

async function main() {
  const startTime = Date.now();
  
  console.log('🚀 Запуск мониторинга синхронизации Umnico...\n');
  console.log('Обновление каждые 5 секунд...\n');
  
  // Первый вывод
  const initialStats = await getStats();
  displayStats(initialStats, startTime);
  
  // Обновление каждые 5 секунд
  const interval = setInterval(async () => {
    const stats = await getStats();
    displayStats(stats, startTime);
    
    // Если все обработано - завершаем
    if (stats && parseInt(stats.ids.pending) === 0) {
      clearInterval(interval);
      console.log('\n✅ Все чаты обработаны!');
      await sql.end();
      process.exit(0);
    }
  }, UPDATE_INTERVAL);
  
  // Обработка Ctrl+C
  process.on('SIGINT', async () => {
    clearInterval(interval);
    clearScreen();
    console.log('\n⚠️  Мониторинг остановлен\n');
    await sql.end();
    process.exit(0);
  });
}

main().catch(async (error) => {
  console.error('❌ Критическая ошибка:', error);
  await sql.end();
  process.exit(1);
});

