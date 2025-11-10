#!/usr/bin/env node
/**
 * Ручной парсинг всех сообщений из Umnico
 * 
 * Процесс:
 * 1. Получает все диалоги из Umnico через Playwright Service
 * 2. Для каждого диалога получает ВСЕ сообщения
 * 3. Сохраняет в БД с детальным прогрессом в консоли
 * 
 * Использование:
 *   node setup/parse_all_messages.mjs
 *   node setup/parse_all_messages.mjs --limit 10  # Ограничить количество диалогов
 */

import postgres from 'postgres';
import fetch from 'node-fetch';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const PLAYWRIGHT_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Парсинг аргументов
const args = process.argv.slice(2);
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;

// Статистика
const stats = {
  totalConversations: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  totalMessages: 0,
  messagesInserted: 0,
  messagesSkipped: 0,
  startTime: Date.now()
};

// Утилиты для форматирования
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}м ${secs}с` : `${secs}с`;
}

function formatProgress(current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const barLength = 30;
  const filled = Math.round((percent / 100) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  return `[${bar}] ${percent}% (${current}/${total})`;
}

// Получение всех диалогов из Umnico
async function getAllConversations() {
  console.log('\n📋 Получение списка диалогов из Umnico...\n');
  
  try {
    const response = await fetch(`${PLAYWRIGHT_URL}/api/conversations?limit=1000`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || 'Unknown error');
    }
    
    // API возвращает {ok: true, count: N, data: [...]}
    const conversations = data.data || data.conversations || [];
    console.log(`✅ Получено ${conversations.length} диалогов\n`);
    
    return conversations;
  } catch (error) {
    console.error('❌ Ошибка при получении диалогов:', error.message);
    throw error;
  }
}

// Получение всех сообщений для диалога
async function getMessagesForConversation(conversationId, getAll = false) {
  try {
    // Добавляем параметр ?all=true для получения всех сообщений
    const url = getAll 
      ? `${PLAYWRIGHT_URL}/api/conversations/${conversationId}/messages?all=true`
      : `${PLAYWRIGHT_URL}/api/conversations/${conversationId}/messages`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || 'Unknown error');
    }
    
    // API возвращает {ok: true, conversationId: "...", count: N, data: [...]}
    return data.data || data.messages || [];
  } catch (error) {
    console.error(`    ❌ Ошибка получения сообщений: ${error.message}`);
    return [];
  }
}

// Найти или создать клиента
async function findOrCreateClient(phone, name) {
  if (!phone || !phone.trim()) {
    return null;
  }

  const normalizedPhone = phone.trim();

  // Ищем существующего клиента
  const existing = await sql`
    SELECT id FROM clients WHERE phone = ${normalizedPhone} LIMIT 1
  `;

  if (existing.length > 0) {
    const clientId = existing[0].id;
    
    // Обновляем имя если изменилось
    if (name && name !== normalizedPhone) {
      await sql`
        UPDATE clients 
        SET name = COALESCE(${name}, name), updated_at = now()
        WHERE id = ${clientId}
      `;
    }
    
    return clientId;
  }

  // Создаем нового клиента
  const [newClient] = await sql`
    INSERT INTO clients (id, phone, name, updated_at)
    VALUES (gen_random_uuid(), ${normalizedPhone}, ${name || null}, now())
    RETURNING id
  `;

  return newClient.id;
}

// Найти или создать диалог
async function findOrCreateConversation(conversationId, clientId, channel, channelAccount) {
  // Ищем существующий диалог
  const existing = await sql`
    SELECT id FROM conversations 
    WHERE umnico_conversation_id = ${String(conversationId)} 
    LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Создаем новый диалог
  const [newConv] = await sql`
    INSERT INTO conversations (
      id, client_id, umnico_conversation_id, channel, channel_account, 
      status, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), ${clientId}, ${String(conversationId)}, 
      ${channel || 'whatsapp'}, ${channelAccount || null},
      'active', now(), now()
    )
    RETURNING id
  `;

  return newConv.id;
}

// Сохранение сообщений
async function saveMessages(conversationId, clientId, messages) {
  if (!messages || messages.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Проверяем наличие колонки booking_id
  const hasBookingId = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'booking_id'
    LIMIT 1
  `;
  const includeBookingId = hasBookingId.length > 0;

  let inserted = 0;
  let skipped = 0;

  for (const msg of messages) {
    try {
      // Создаем уникальный ID
      const datetimeStr = msg.datetime || new Date().toISOString();
      const uniqueId = `${conversationId}_${datetimeStr.replace(/[^0-9]/g, '')}_${msg.index || 0}`;

      // Парсим datetime
      let sentAt;
      try {
        if (msg.datetime) {
          // Формат: "08.11.2025 17:17" или "10.11.2025 19:35"
          const dateStr = msg.datetime.trim();
          if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/)) {
            // Конвертируем DD.MM.YYYY HH:mm в ISO формат
            const [datePart, timePart] = dateStr.split(' ');
            const [day, month, year] = datePart.split('.');
            sentAt = new Date(`${year}-${month}-${day}T${timePart}:00`);
          } else {
            // Пробуем стандартный парсинг
            sentAt = new Date(dateStr);
          }
          
          // Проверяем валидность
          if (isNaN(sentAt.getTime())) {
            throw new Error('Invalid date');
          }
        } else {
          sentAt = new Date();
        }
      } catch (e) {
        // Если не удалось распарсить, используем текущую дату
        console.warn(`      ⚠️  Не удалось распарсить дату: ${msg.datetime}, используем текущую дату`);
        sentAt = new Date();
      }

      // Проверяем, существует ли уже сообщение
      const existing = await sql`
        SELECT id FROM messages WHERE umnico_message_id = ${uniqueId} LIMIT 1
      `;

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Вставляем сообщение
      if (includeBookingId) {
        await sql`
          INSERT INTO messages (
            id, conversation_id, client_id, booking_id, text, direction, 
            channel, sent_at, umnico_message_id, metadata, created_at
          )
          VALUES (
            gen_random_uuid(), ${conversationId}, ${clientId}, null,
            ${msg.text || null}, ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'},
            ${msg.channel || 'whatsapp'}, ${sentAt}, ${uniqueId},
            ${JSON.stringify({
              time: msg.time,
              hasAttachments: msg.hasAttachments,
              channelAccount: msg.channelAccount
            })}::jsonb, now()
          )
        `;
      } else {
        await sql`
          INSERT INTO messages (
            id, conversation_id, client_id, text, direction, 
            channel, sent_at, umnico_message_id, metadata, created_at
          )
          VALUES (
            gen_random_uuid(), ${conversationId}, ${clientId},
            ${msg.text || null}, ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'},
            ${msg.channel || 'whatsapp'}, ${sentAt}, ${uniqueId},
            ${JSON.stringify({
              time: msg.time,
              hasAttachments: msg.hasAttachments,
              channelAccount: msg.channelAccount
            })}::jsonb, now()
          )
        `;
      }

      inserted++;
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        skipped++;
      } else {
        console.error(`      ⚠️  Ошибка сохранения сообщения: ${error.message}`);
      }
    }
  }

  return { inserted, skipped };
}

// Обновление last_message_at и last_message_preview
async function updateConversationMetadata(conversationId, messages) {
  if (!messages || messages.length === 0) {
    return;
  }

  // Находим последнее сообщение
  const lastMessage = messages
    .filter(m => m.datetime)
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0];

  if (lastMessage) {
    const lastMessageAt = new Date(lastMessage.datetime);
    const lastMessagePreview = lastMessage.text ? lastMessage.text.substring(0, 200) : null;

    await sql`
      UPDATE conversations
      SET 
        last_message_at = ${lastMessageAt},
        last_message_preview = ${lastMessagePreview},
        updated_at = now()
      WHERE id = ${conversationId}
    `;
  }
}

// Основной процесс
async function parseAllMessages() {
  console.log('🚀 Начало парсинга всех сообщений из Umnico\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Получаем все диалоги
    let conversations = await getAllConversations();
    
    if (limit && limit > 0) {
      conversations = conversations.slice(0, limit);
      console.log(`⚠️  Ограничение: обрабатываем только первые ${limit} диалогов\n`);
    }

    stats.totalConversations = conversations.length;

    // 2. Обрабатываем каждый диалог
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const conversationId = conv.conversationId;
      const phone = conv.phone || '';
      const name = conv.phone || conv.assignedTo || '';

      stats.processed++;

      // Прогресс-бар
      const progress = formatProgress(i + 1, conversations.length);
      const elapsed = formatTime(Date.now() - stats.startTime);
      const avgTime = stats.processed > 0 ? formatTime((Date.now() - stats.startTime) / stats.processed) : '0с';
      const estimated = stats.processed > 0 
        ? formatTime(((Date.now() - stats.startTime) / stats.processed) * (conversations.length - stats.processed))
        : '?';

      console.log(`\n${progress} | Время: ${elapsed} | Среднее: ${avgTime}/диалог | Осталось: ~${estimated}`);
      console.log(`\n📞 [${i + 1}/${conversations.length}] Диалог ID: ${conversationId || 'N/A'}`);
      console.log(`   Телефон: ${phone || 'N/A'}`);

      if (!conversationId) {
        console.log(`   ⚠️  Пропуск: нет conversationId`);
        stats.skipped++;
        continue;
      }

      try {
        // Получаем сообщения (ВСЕ, включая старые)
        process.stdout.write(`   📨 Получение всех сообщений (со скроллингом)... `);
        const messages = await getMessagesForConversation(conversationId, true); // true = получить все
        console.log(`✅ ${messages.length} сообщений`);

        if (messages.length === 0) {
          console.log(`   ⏭️  Пропуск: нет сообщений`);
          stats.skipped++;
          continue;
        }

        stats.totalMessages += messages.length;

        // Находим или создаем клиента
        process.stdout.write(`   👤 Поиск/создание клиента... `);
        const clientId = await findOrCreateClient(phone, name);
        if (!clientId) {
          console.log(`⚠️  Пропуск: не удалось создать клиента`);
          stats.skipped++;
          continue;
        }
        console.log(`✅ ID: ${clientId}`);

        // Находим или создаем диалог
        process.stdout.write(`   💬 Поиск/создание диалога... `);
        const dbConversationId = await findOrCreateConversation(
          conversationId,
          clientId,
          conv.channelAccount || 'whatsapp',
          conv.channelAccount
        );
        console.log(`✅ ID: ${dbConversationId}`);

        // Сохраняем сообщения
        process.stdout.write(`   💾 Сохранение ${messages.length} сообщений... `);
        const result = await saveMessages(dbConversationId, clientId, messages);
        console.log(`✅ Вставлено: ${result.inserted}, Пропущено: ${result.skipped}`);

        stats.messagesInserted += result.inserted;
        stats.messagesSkipped += result.skipped;

        // Обновляем метаданные диалога
        await updateConversationMetadata(dbConversationId, messages);

      } catch (error) {
        console.error(`\n   ❌ Ошибка обработки диалога: ${error.message}`);
        stats.errors++;
      }
    }

    // Финальная статистика
    const totalTime = formatTime(Date.now() - stats.startTime);
    
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ПАРСИНГ ЗАВЕРШЕН\n');
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   Диалогов обработано:     ${stats.processed}/${stats.totalConversations}`);
    console.log(`   Диалогов пропущено:      ${stats.skipped}`);
    console.log(`   Ошибок:                  ${stats.errors}`);
    console.log(`   Всего сообщений:         ${stats.totalMessages}`);
    console.log(`   Сообщений вставлено:     ${stats.messagesInserted}`);
    console.log(`   Сообщений пропущено:     ${stats.messagesSkipped}`);
    console.log(`   Общее время:             ${totalTime}`);
    console.log(`   Среднее время/диалог:    ${formatTime((Date.now() - stats.startTime) / Math.max(stats.processed, 1))}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запуск
parseAllMessages().catch(console.error);

