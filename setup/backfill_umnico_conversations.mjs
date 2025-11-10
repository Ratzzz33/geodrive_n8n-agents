#!/usr/bin/env node
/**
 * Backfill скрипт: Парсинг всех существующих диалогов из Umnico
 * 
 * Процесс:
 * 1. Получает все диалоги из Umnico через Playwright Service
 * 2. Для каждого диалога:
 *    - Получает все сообщения
 *    - Находит/создает клиента по phone
 *    - Создает/обновляет conversation
 *    - Связывает с booking если есть (через phone -> client_id)
 *    - Сохраняет все сообщения
 * 
 * Использование:
 *   node setup/backfill_umnico_conversations.mjs
 *   node setup/backfill_umnico_conversations.mjs --limit 100  # Ограничить количество
 *   node setup/backfill_umnico_conversations.mjs --skip-existing  # Пропустить существующие
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
const skipExisting = args.includes('--skip-existing');

// Статистика
const stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  clientsCreated: 0,
  clientsUpdated: 0,
  conversationsCreated: 0,
  conversationsUpdated: 0,
  messagesInserted: 0,
  bookingsLinked: 0
};

/**
 * Нормализация телефона для поиска
 * Umnico уже валидирует все номера/ники, поэтому принимаем любые значения
 */
function normalizePhone(phone) {
  if (!phone) return null;
  // Umnico валидирует все значения, поэтому просто возвращаем как есть
  // Для поиска используем оригинальное значение (может быть телефон, Telegram ник, имя и т.д.)
  return phone.trim();
}

/**
 * Найти клиента по телефону или создать нового
 */
async function findOrCreateClient(phone, name) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.log(`  ⚠️  Empty phone, skipping`);
    return null;
  }

  // Ищем существующего клиента по точному совпадению
  // Umnico валидирует все значения, поэтому ищем как есть
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
      stats.clientsUpdated++;
    }
    
    return clientId;
  }

  // Создаем нового клиента
  const [newClient] = await sql`
    INSERT INTO clients (id, phone, name, updated_at)
    VALUES (gen_random_uuid(), ${normalizedPhone}, ${name || null}, now())
    RETURNING id
  `;

  stats.clientsCreated++;
  return newClient.id;
}

/**
 * Создать external_ref для Umnico
 */
async function ensureExternalRef(clientId, umnicoId) {
  if (!umnicoId) return;
  
  // Проверяем существование
  const existing = await sql`
    SELECT id FROM external_refs
    WHERE system = 'umnico' AND external_id = ${String(umnicoId)}
    LIMIT 1
  `;
  
  if (existing.length > 0) {
    return; // Уже существует
  }
  
  // Создаем новый
  await sql`
    INSERT INTO external_refs (entity_type, entity_id, system, external_id)
    VALUES ('client', ${clientId}, 'umnico', ${String(umnicoId)})
  `;
}

/**
 * Найти активную или последнюю booking по client_id
 */
async function findBookingByClientId(clientId) {
  // Сначала ищем активные брони
  const activeBookings = await sql`
    SELECT id, start_at, end_at, status
    FROM bookings
    WHERE client_id = ${clientId}
      AND status IN ('planned', 'active')
    ORDER BY start_at DESC
    LIMIT 1
  `;
  
  if (activeBookings.length > 0) {
    return activeBookings[0].id;
  }
  
  // Если нет активных, берем последнюю завершенную
  const lastBooking = await sql`
    SELECT id, start_at, end_at, status
    FROM bookings
    WHERE client_id = ${clientId}
    ORDER BY start_at DESC
    LIMIT 1
  `;
  
  return lastBooking.length > 0 ? lastBooking[0].id : null;
}

/**
 * Создать или обновить conversation
 */
async function upsertConversation(clientId, conversationData, lastMessagePreview) {
  const {
    conversationId,
    channel,
    channelAccount,
    lastMessageAt
  } = conversationData;

  if (!conversationId) {
    console.log(`  ⚠️  No conversationId, skipping`);
    return null;
  }

  // Проверяем существование
  const existing = await sql`
    SELECT id FROM conversations 
    WHERE umnico_conversation_id = ${String(conversationId)}
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Обновляем
    await sql`
      UPDATE conversations
      SET 
        last_message_at = ${lastMessageAt ? new Date(lastMessageAt) : null},
        last_message_preview = ${lastMessagePreview || null},
        channel = COALESCE(${channel}, channel),
        channel_account = COALESCE(${channelAccount}, channel_account),
        updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    stats.conversationsUpdated++;
    return existing[0].id;
  }

  // Создаем новый
  const [newConv] = await sql`
    INSERT INTO conversations (
      id, client_id, umnico_conversation_id, channel, channel_account, 
      status, last_message_at, last_message_preview, updated_at
    )
    VALUES (
      gen_random_uuid(), ${clientId}, ${String(conversationId)}, 
      ${channel || 'whatsapp'}, ${channelAccount || null},
      'active', ${lastMessageAt ? new Date(lastMessageAt) : null}, 
      ${lastMessagePreview || null}, now()
    )
    RETURNING id
  `;

  stats.conversationsCreated++;
  return newConv.id;
}

/**
 * Вставить сообщения в БД
 */
async function insertMessages(conversationId, clientId, bookingId, messages) {
  if (!messages || messages.length === 0) return;

  // Генерируем уникальный ID для каждого сообщения на основе conversationId + datetime + index
  const values = messages.map((m, index) => {
    // Создаем уникальный ID: conversationId_datetime_index
    const datetimeStr = m.datetime || new Date().toISOString();
    const uniqueId = `${conversationId}_${datetimeStr.replace(/[^0-9]/g, '')}_${index}`;
    
    // Парсим datetime (может быть в разных форматах)
    let sentAt = new Date();
    if (m.datetime) {
      const parsed = new Date(m.datetime);
      if (!isNaN(parsed.getTime())) {
        sentAt = parsed;
      }
    }

    return {
      conversation_id: conversationId,
      client_id: clientId,
      booking_id: bookingId,
      text: m.text || null,
      direction: m.direction === 'incoming' ? 'incoming' : 'outgoing',
      channel: m.channel || 'whatsapp',
      sent_at: sentAt,
      umnico_message_id: uniqueId,
      metadata: JSON.stringify({
        time: m.time,
        hasAttachments: m.hasAttachments || false,
        channelAccount: m.channelAccount || null,
        index: index
      })
    };
  });

  // Проверяем наличие колонки booking_id
  const hasBookingId = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'booking_id'
    LIMIT 1
  `;
  const includeBookingId = hasBookingId.length > 0;

  // Batch insert с skip on conflict
  for (const value of values) {
    try {
      if (includeBookingId) {
        await sql`
          INSERT INTO messages (
            id, conversation_id, client_id, booking_id, text, direction, 
            channel, sent_at, umnico_message_id, metadata, created_at
          )
          VALUES (
            gen_random_uuid(), ${value.conversation_id}, ${value.client_id}, 
            ${value.booking_id}, ${value.text}, ${value.direction},
            ${value.channel}, ${value.sent_at}, ${value.umnico_message_id},
            ${value.metadata}::jsonb, now()
          )
          ON CONFLICT (umnico_message_id) DO NOTHING
        `;
      } else {
        await sql`
          INSERT INTO messages (
            id, conversation_id, client_id, text, direction, 
            channel, sent_at, umnico_message_id, metadata, created_at
          )
          VALUES (
            gen_random_uuid(), ${value.conversation_id}, ${value.client_id}, 
            ${value.text}, ${value.direction},
            ${value.channel}, ${value.sent_at}, ${value.umnico_message_id},
            ${value.metadata}::jsonb, now()
          )
          ON CONFLICT (umnico_message_id) DO NOTHING
        `;
      }
      stats.messagesInserted++;
    } catch (error) {
      console.error(`    ❌ Failed to insert message:`, error.message);
    }
  }
}

/**
 * Обработать один диалог
 */
async function processConversation(conv) {
  const { conversationId, phone, lastMessage } = conv;
  
  if (!conversationId) {
    console.log(`  ⚠️  Skipping conversation without ID (phone: ${phone})`);
    stats.skipped++;
    return;
  }

  // Проверяем существование если нужно
  if (skipExisting) {
    const existing = await sql`
      SELECT id FROM conversations 
      WHERE umnico_conversation_id = ${String(conversationId)}
      LIMIT 1
    `;
    
    if (existing.length > 0) {
      console.log(`  ⏭️  Skipping existing conversation ${conversationId}`);
      stats.skipped++;
      return;
    }
  }

  try {
    console.log(`\n📞 Processing conversation ${conversationId} (phone: ${phone})`);

    // 1. Получаем сообщения из Umnico
    console.log(`  📥 Fetching messages...`);
    const messagesResponse = await fetch(
      `${PLAYWRIGHT_URL}/api/conversations/${conversationId}/messages`,
      { timeout: 30000 }
    );

    if (!messagesResponse.ok) {
      throw new Error(`HTTP ${messagesResponse.status}: ${await messagesResponse.text()}`);
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.data || [];
    console.log(`  ✅ Got ${messages.length} messages`);

    // 2. Находим/создаем клиента
    console.log(`  👤 Finding/creating client...`);
    const clientId = await findOrCreateClient(phone, phone); // name = phone пока
    if (!clientId) {
      throw new Error('Failed to create client');
    }

    // 3. Создаем external_ref для Umnico
    await ensureExternalRef(clientId, conversationId);

    // 4. Находим booking если есть
    const bookingId = await findBookingByClientId(clientId);
    if (bookingId) {
      console.log(`  🔗 Linked to booking ${bookingId}`);
      stats.bookingsLinked++;
    }

    // 5. Создаем/обновляем conversation
    console.log(`  💬 Upserting conversation...`);
    const lastMessageObj = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastMessageAt = lastMessageObj?.datetime || null;
    
    const conversationId_db = await upsertConversation(
      clientId,
      {
        conversationId,
        channel: conv.channelAccount ? 'whatsapp' : 'unknown',
        channelAccount: conv.channelAccount,
        lastMessageAt
      },
      lastMessage || null
    );

    if (!conversationId_db) {
      throw new Error('Failed to create conversation');
    }

    // 6. Вставляем сообщения
    if (messages.length > 0) {
      console.log(`  💾 Inserting ${messages.length} messages...`);
      await insertMessages(conversationId_db, clientId, bookingId, messages);
      console.log(`  ✅ Inserted ${messages.length} messages`);
    }

    // 7. Обновляем booking_id в conversation если нашли booking
    if (bookingId) {
      await sql`
        UPDATE conversations
        SET updated_at = now()
        WHERE id = ${conversationId_db}
      `;
      
      // Обновляем booking_id в сообщениях этого диалога
      await sql`
        UPDATE messages
        SET booking_id = ${bookingId}
        WHERE conversation_id = ${conversationId_db}
          AND booking_id IS NULL
      `;
    }

    stats.processed++;
    console.log(`  ✅ Conversation ${conversationId} processed successfully`);

  } catch (error) {
    console.error(`  ❌ Error processing conversation ${conversationId}:`, error.message);
    stats.errors++;
  }
}

/**
 * Главная функция
 */
async function main() {
  console.log('\n🚀 Umnico Conversations Backfill');
  console.log('================================\n');

  try {
    // 1. Получаем список всех диалогов
    console.log('📋 Fetching conversations from Umnico...');
    const convResponse = await fetch(
      `${PLAYWRIGHT_URL}/api/conversations?limit=${limit || 1000}`,
      { timeout: 60000 }
    );

    if (!convResponse.ok) {
      throw new Error(`HTTP ${convResponse.status}: ${await convResponse.text()}`);
    }

    const convData = await convResponse.json();
    const conversations = convData.data || [];
    
    stats.total = conversations.length;
    console.log(`✅ Found ${conversations.length} conversations\n`);

    if (conversations.length === 0) {
      console.log('⚠️  No conversations found');
      return;
    }

    // 2. Обрабатываем каждый диалог
    console.log(`🔄 Processing ${conversations.length} conversations...\n`);
    
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      console.log(`[${i + 1}/${conversations.length}]`);
      await processConversation(conv);
      
      // Небольшая задержка чтобы не перегружать сервис
      if (i < conversations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 3. Выводим статистику
    console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('================================');
    console.log(`Всего диалогов:        ${stats.total}`);
    console.log(`Обработано:            ${stats.processed}`);
    console.log(`Пропущено:             ${stats.skipped}`);
    console.log(`Ошибок:                ${stats.errors}`);
    console.log(`\nКлиентов создано:      ${stats.clientsCreated}`);
    console.log(`Клиентов обновлено:    ${stats.clientsUpdated}`);
    console.log(`Диалогов создано:      ${stats.conversationsCreated}`);
    console.log(`Диалогов обновлено:    ${stats.conversationsUpdated}`);
    console.log(`Сообщений вставлено:   ${stats.messagesInserted}`);
    console.log(`Броней связано:        ${stats.bookingsLinked}`);
    console.log('================================\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

