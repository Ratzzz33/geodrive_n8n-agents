#!/usr/bin/env node

/**
 * Парсинг сообщений для ВСЕХ ID из umnico_chat_ids_full.json
 * 
 * Обрабатывает:
 * 1. Все ID из файла umnico_chat_ids_full.json
 * 2. Все существующие диалоги из БД
 * 
 * Использует Playwright Service для получения полной истории каждого чата
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

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const BATCH_SIZE = 10; // Обрабатываем по 10 чатов за раз
const DELAY_BETWEEN_REQUESTS = 2000; // 2 секунды между запросами

console.log('🔄 Запуск парсинга сообщений для всех ID из umnico_chat_ids_full.json...\n');

async function parseAllIds() {
  try {
    // 1. Читаем ID из файла
    console.log('📂 Чтение umnico_chat_ids_full.json...');
    const fileContent = readFileSync('umnico_chat_ids_full.json', 'utf8');
    const fileData = JSON.parse(fileContent);
    const idsFromFile = fileData.ids || fileData || [];
    
    console.log(`✅ Прочитано ${idsFromFile.length} ID из файла\n`);
    
    // 2. Получаем существующие диалоги из БД
    console.log('📋 Получение существующих диалогов из БД...');
    const existingConversations = await sql`
      SELECT umnico_conversation_id
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
    `;
    
    const existingIds = new Set(existingConversations.map(c => c.umnico_conversation_id));
    console.log(`✅ Найдено ${existingIds.size} существующих диалогов в БД\n`);
    
    // 3. Объединяем все ID (уникальные)
    const allIds = [...new Set([...idsFromFile, ...Array.from(existingIds)])];
    console.log(`📊 Всего уникальных ID для обработки: ${allIds.length}`);
    console.log(`   - Из файла: ${idsFromFile.length}`);
    console.log(`   - Из БД: ${existingIds.size}`);
    console.log(`   - Новых (только в файле): ${idsFromFile.filter(id => !existingIds.has(String(id))).length}\n`);
    
    // Статистика
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    let totalMessagesAdded = 0;
    let totalMessagesUpdated = 0;
    let incompleteCount = 0;
    let newConversations = 0;
    
    // Обрабатываем батчами
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Обработка батча ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allIds.length / BATCH_SIZE)} (${batch.length} диалогов)\n`);
      
      for (const umnicoId of batch) {
        try {
          const idStr = String(umnicoId);
          console.log(`\n🔍 [${processed + failed + skipped + 1}/${allIds.length}] Диалог ID: ${idStr}`);
          
          // Проверяем, есть ли уже диалог в БД
          const existingConv = await sql`
            SELECT id, client_id, client_name, channel, metadata
            FROM conversations
            WHERE umnico_conversation_id = ${idStr}
            LIMIT 1
          `;
          
          const isNew = existingConv.length === 0;
          if (isNew) {
            console.log(`   🆕 Новый диалог (нет в БД)`);
            newConversations++;
          } else {
            console.log(`   📝 Существующий диалог: ${existingConv[0].client_name || 'Unknown'}`);
          }
          
          // 1. Получить сообщения (НОВАЯ ЛОГИКА V2)
          console.log('   📥 Получение сообщений (с умной логикой x/y)...');
          const messagesResponse = await fetch(
            `${PLAYWRIGHT_SERVICE_URL}/api/conversations/${idStr}/messages`
          );
          
          if (!messagesResponse.ok) {
            throw new Error(`HTTP ${messagesResponse.status}: ${messagesResponse.statusText}`);
          }
          
          const messagesData = await messagesResponse.json();
          
          if (!messagesData.ok) {
            throw new Error(messagesData.error || 'Unknown error');
          }
          
          // НОВЫЙ ФОРМАТ API V2
          const messages = messagesData.data || [];
          const messageCount = messagesData.count || messages.length;
          const total = messagesData.total;
          const incomplete = messagesData.incomplete || false;
          const clientPhone = messagesData.clientPhone;
          const clientTelegram = messagesData.clientTelegram;
          const channel = (messagesData.channel || 'unknown').toString();
          const channelAccount = messagesData.channelAccount ? messagesData.channelAccount.toString() : null;
          
          // Анализ x/y
          if (messageCount < total) {
            console.log(`   ✅ Получено ${messageCount}/${total} сообщений (всё получили)`);
          } else if (messageCount === total && total > 0) {
            console.log(`   🔄 Получено ${messageCount}/${total} сообщений (x=y, возможно нужно прокрутить)`);
          } else {
            console.log(`   ⚠️  Получено ${messageCount} сообщений (total неизвестен)`);
          }
          
          if (incomplete) {
            console.log(`   ⚠️  Диалог помечен как incomplete (требует ручной доработки)`);
            incompleteCount++;
          }
          
          if (messageCount === 0) {
            console.log(`   ⚠️  Нет сообщений, пропускаем`);
            skipped++;
            continue;
          }
          
          // 2. Обработка клиента
          const firstIncoming = messages.find(m => m.direction === 'incoming' || !m.direction);
          const clientName = firstIncoming?.author || firstIncoming?.clientName || 'Unknown';
          const clientEmail = firstIncoming?.email || null;
          
          let clientId;
          
          // НОВАЯ ЛОГИКА: поддержка Telegram клиентов без телефона
          if (clientPhone) {
            // WhatsApp клиент (есть телефон)
            const normalizedPhone = clientPhone.replace(/[\s\-\(\)]/g, '');
            
            const existingClient = await sql`
              SELECT id FROM clients WHERE phone = ${normalizedPhone} LIMIT 1
            `;
            
            if (existingClient.length > 0) {
              clientId = existingClient[0].id;
              if (clientName && clientName !== 'Unknown') {
                await sql`
                  UPDATE clients 
                  SET name = ${clientName}, updated_at = NOW()
                  WHERE id = ${clientId}
                `;
              }
            } else {
              const newClient = await sql`
                INSERT INTO clients (name, phone, email, created_at, updated_at)
                VALUES (${clientName}, ${normalizedPhone}, ${clientEmail}, NOW(), NOW())
                RETURNING id
              `;
              clientId = newClient[0].id;
            }
          } else if (clientTelegram) {
            // Telegram клиент (нет телефона, есть username)
            const existingClient = await sql`
              SELECT id FROM clients WHERE telegram_username = ${clientTelegram} LIMIT 1
            `;
            
            if (existingClient.length > 0) {
              clientId = existingClient[0].id;
              if (clientName && clientName !== 'Unknown') {
                await sql`
                  UPDATE clients 
                  SET name = ${clientName}, updated_at = NOW()
                  WHERE id = ${clientId}
                `;
              }
            } else {
              const newClient = await sql`
                INSERT INTO clients (name, telegram_username, email, created_at, updated_at)
                VALUES (${clientName}, ${clientTelegram}, ${clientEmail}, NOW(), NOW())
                RETURNING id
              `;
              clientId = newClient[0].id;
            }
          } else {
            // Нет ни телефона, ни Telegram username
            const newClient = await sql`
              INSERT INTO clients (name, email, created_at, updated_at)
              VALUES (${clientName}, ${clientEmail}, NOW(), NOW())
              RETURNING id
            `;
            clientId = newClient[0].id;
          }
          
          // 3. Создать или обновить conversation
          const metadata = {
            incomplete: incomplete,
            loaded: messageCount,
            total: total,
            client_name: clientName,
            last_sync: new Date().toISOString(),
            client_phone: clientPhone || null,
            client_telegram: clientTelegram || null,
            channel_account: channelAccount || null
          };
          
          const conversationResult = await sql`
            INSERT INTO conversations (
              client_id,
              umnico_conversation_id,
              channel,
              channel_account,
              status,
              last_message_at,
              metadata,
              created_at,
              updated_at
            )
            VALUES (
              ${clientId},
              ${idStr},
              ${channel},
              ${channelAccount},
              ${'active'},
              NOW(),
              ${JSON.stringify(metadata)},
              NOW(),
              NOW()
            )
            ON CONFLICT (umnico_conversation_id) DO UPDATE
            SET 
              client_id = EXCLUDED.client_id,
              channel = EXCLUDED.channel,
              channel_account = EXCLUDED.channel_account,
              status = EXCLUDED.status,
              last_message_at = NOW(),
              metadata = ${JSON.stringify(metadata)},
              updated_at = NOW()
            RETURNING id
          `;
          
          const conversationId = conversationResult[0].id;
          
          // 4. Сохранить/обновить сообщения
          let messagesAdded = 0;
          let messagesUpdated = 0;
          
          for (const msg of messages) {
            // Определяем direction: incoming = от клиента, outgoing = к клиенту
            const direction = msg.type === 'incoming' || msg.direction === 'incoming' ? 'incoming' : 'outgoing';
            
            // Парсим дату
            let sentAt = new Date();
            if (msg.datetime) {
              try {
                const dateStr = msg.datetime.trim();
                // Формат "09.11.2025 10:40"
                if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/)) {
                  const [datePart, timePart] = dateStr.split(' ');
                  const [day, month, year] = datePart.split('.');
                  sentAt = new Date(`${year}-${month}-${day}T${timePart}:00`);
                } else if (dateStr.includes('T') || dateStr.includes('-')) {
                  sentAt = new Date(dateStr);
                } else {
                  sentAt = new Date(dateStr);
                }
                
                if (isNaN(sentAt.getTime())) {
                  sentAt = new Date();
                }
              } catch (e) {
                sentAt = new Date();
              }
            } else if (msg.timestamp) {
              sentAt = new Date(msg.timestamp);
              if (isNaN(sentAt.getTime())) {
                sentAt = new Date();
              }
            }
            
            const umnicoMessageId = msg.id || msg.umnico_message_id || null;
            
            // Если есть umnico_message_id, используем ON CONFLICT
            if (umnicoMessageId) {
              const result = await sql`
                INSERT INTO messages (
                  client_id,
                  conversation_id,
                  direction,
                  channel,
                  text,
                  sent_at,
                  umnico_message_id,
                  attachments,
                  metadata,
                  created_at
                )
                VALUES (
                  ${clientId},
                  ${conversationId},
                  ${direction},
                  ${channel},
                  ${msg.text || ''},
                  ${sentAt},
                  ${umnicoMessageId},
                  ${JSON.stringify(msg.attachments || [])},
                  ${JSON.stringify({
                    author: msg.author || null,
                    channel_account: channelAccount || null,
                    raw: msg
                  }) || '{}'},
                  NOW()
                )
                ON CONFLICT (umnico_message_id) DO UPDATE
                SET
                  direction = EXCLUDED.direction,
                  channel = EXCLUDED.channel,
                  text = EXCLUDED.text,
                  sent_at = EXCLUDED.sent_at,
                  metadata = EXCLUDED.metadata,
                  updated_at = NOW()
                RETURNING id
              `;
              
              if (result.length > 0) {
                // Проверяем, был ли это INSERT или UPDATE
                const wasInsert = result[0].id && !existingConv.length; // Если диалог новый, то сообщения тоже новые
                if (wasInsert || !existingConv.length) {
                  messagesAdded++;
                } else {
                  messagesUpdated++;
                }
              }
            } else {
              // Если нет ID, проверяем дубликат по conversation_id + sent_at + text
              const existing = await sql`
                SELECT id FROM messages 
                WHERE conversation_id = ${conversationId}
                  AND sent_at = ${sentAt}
                  AND text = ${msg.text || ''}
                LIMIT 1
              `;
              
              if (existing.length === 0) {
                await sql`
                  INSERT INTO messages (
                    client_id,
                    conversation_id,
                    direction,
                    channel,
                    text,
                    sent_at,
                    umnico_message_id,
                    attachments,
                    metadata,
                    created_at
                  )
                  VALUES (
                    ${clientId},
                    ${conversationId},
                    ${direction},
                    ${channel},
                    ${msg.text || ''},
                    ${sentAt},
                    NULL,
                    ${JSON.stringify(msg.attachments || [])},
                    ${JSON.stringify({
                      author: msg.author || null,
                      channel_account: channelAccount || null,
                      raw: msg
                    }) || '{}'},
                    NOW()
                  )
                `;
                messagesAdded++;
              } else {
                messagesUpdated++;
              }
            }
          }
          
          // Обновляем last_message_at
          await sql`
            UPDATE conversations
            SET
              last_message_at = (
                SELECT MAX(sent_at) FROM messages WHERE conversation_id = ${conversationId}
              ),
              updated_at = NOW()
            WHERE id = ${conversationId}
          `;
          
          console.log(`   ✅ Сохранено: +${messagesAdded} новых, ~${messagesUpdated} обновлено`);
          totalMessagesAdded += messagesAdded;
          totalMessagesUpdated += messagesUpdated;
          processed++;
          
        } catch (error) {
          console.error(`   ❌ Ошибка: ${error.message}`);
          failed++;
        }
        
        // Задержка между запросами
        if (processed + failed + skipped < allIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
      }
      
      // Пауза между батчами
      if (i + BATCH_SIZE < allIds.length) {
        console.log(`\n⏸️  Пауза 5 секунд перед следующим батчем...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Итоговая статистика
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(60));
    console.log(`✅ Успешно обработано: ${processed}`);
    console.log(`❌ Ошибок: ${failed}`);
    console.log(`⏭️  Пропущено (нет сообщений): ${skipped}`);
    console.log(`🆕 Новых диалогов создано: ${newConversations}`);
    console.log(`📨 Всего добавлено сообщений: ${totalMessagesAdded}`);
    console.log(`📝 Всего обновлено сообщений: ${totalMessagesUpdated}`);
    console.log(`⚠️  Неполных диалогов: ${incompleteCount}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Запуск
parseAllIds()
  .then(() => {
    console.log('\n✅ Парсинг завершен!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Парсинг завершился с ошибкой:', error);
    process.exit(1);
  });

