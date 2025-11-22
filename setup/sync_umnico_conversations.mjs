#!/usr/bin/env node

/**
 * Синхронизация переписки из Umnico для всех собранных chat ID
 * 
 * Использует Playwright Service для получения полной истории каждого чата
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config();

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const BATCH_SIZE = 5; // Обрабатываем по 5 чатов за раз
const DELAY_BETWEEN_REQUESTS = 2000; // 2 секунды между запросами

console.log('🔄 Запуск синхронизации переписок из Umnico...\n');

async function syncConversations() {
  try {
    // Получаем необработанные ID
    const pendingIds = await sql`
      SELECT id, discovered_at
      FROM umnico_chat_ids
      WHERE processed = FALSE
      ORDER BY discovered_at DESC
      LIMIT ${BATCH_SIZE}
    `;
    
    if (pendingIds.length === 0) {
      console.log('✅ Все чаты обработаны!');
      return;
    }
    
    console.log(`📋 Найдено необработанных чатов: ${pendingIds.length}\n`);
    
    let processed = 0;
    let failed = 0;
    
    for (const chat of pendingIds) {
      try {
        console.log(`\n🔍 Обработка чата ID: ${chat.id}`);
        
        // 1. Получить сообщения (НОВАЯ ЛОГИКА V2)
        console.log('   Получение сообщений (с умной логикой x/y)...');
        const messagesResponse = await fetch(
          `${PLAYWRIGHT_SERVICE_URL}/api/conversations/${chat.id}/messages`
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
        const needsManualProcessing = messagesData.needsManualProcessing || false; // Флаг что требуется ручная обработка
        const clientPhone = messagesData.clientPhone || null;
        const clientTelegram = messagesData.clientTelegram || null;
        let channel = messagesData.channel || 'unknown';
        const channelAccount = messagesData.channelAccount || null;
        
        if (messageCount === 0) {
          console.warn(`   ⚠️  Получено 0 сообщений! Возможно чат пуст или не загрузился`);
        } else {
          console.log(`   ✅ Получено сообщений: ${messageCount}` + 
            (total ? ` (${messageCount}/${total})` : ''));
          
          // НОВАЯ ЛОГИКА: x/y анализ
          if (incomplete) {
            console.warn(`   ⚠️  ВНИМАНИЕ: Диалог помечен как INCOMPLETE!`);
            console.warn(`   ⚠️  Требуется ручная обработка через MCP Chrome или повторная попытка.`);
          } else if (total && messageCount < total) {
            console.log(`   ✅ x < y (${messageCount}/${total}) - всё получили успешно!`);
          } else if (total && messageCount === total) {
            console.log(`   ✅ x = y (${messageCount}/${total}) - прокрутка успешна или это все сообщения`);
          }
          
          // Проверяем что есть сообщения с текстом
          const messagesWithText = messages.filter(m => m.text && m.text.trim().length > 0).length;
          if (messagesWithText === 0) {
            console.warn(`   ⚠️  Все сообщения пустые (без текста)!`);
          } else {
            console.log(`   ✅ Сообщений с текстом: ${messagesWithText}/${messageCount}`);
          }
        }
        
        // 2. Извлекаем информацию о клиенте (НОВАЯ ЛОГИКА)
        // Теперь API возвращает clientPhone и clientTelegram напрямую
        const firstIncoming = messages.find(m => m.direction === 'incoming' || !m.direction);
        const clientName = firstIncoming?.author || firstIncoming?.clientName || 'Unknown';
        const clientEmail = firstIncoming?.email || null;
        
        let clientId;
        
        // НОВАЯ ЛОГИКА: поддержка Telegram клиентов без телефона
        if (clientPhone) {
          // WhatsApp клиент (есть телефон)
          const normalizedPhone = clientPhone.replace(/[\s\-\(\)]/g, '');
          
          // Ищем клиента по телефону
          const existingClient = await sql`
            SELECT id FROM clients WHERE phone = ${normalizedPhone} LIMIT 1
          `;
          
          if (existingClient.length > 0) {
            clientId = existingClient[0].id;
            console.log(`   ✅ Найден существующий WhatsApp клиент: ${clientId}`);
            
            // Обновляем имя если оно изменилось
            if (clientName && clientName !== 'Unknown') {
              await sql`
                UPDATE clients 
                SET name = ${clientName}, updated_at = NOW()
                WHERE id = ${clientId}
              `;
            }
          } else {
            // Создаем нового клиента с телефоном
            const newClient = await sql`
              INSERT INTO clients (name, phone, email, created_at, updated_at)
              VALUES (${clientName}, ${normalizedPhone}, ${clientEmail}, NOW(), NOW())
              RETURNING id
            `;
            clientId = newClient[0].id;
            console.log(`   ✅ Создан новый WhatsApp клиент: ${clientId}`);
          }
        } else if (clientTelegram) {
          // Telegram клиент (нет телефона, есть username)
          console.log(`   ✈️  Telegram клиент: @${clientTelegram}`);
          
          // Ищем клиента по telegram_username
          const existingClient = await sql`
            SELECT id FROM clients WHERE telegram_username = ${clientTelegram} LIMIT 1
          `;
          
          if (existingClient.length > 0) {
            clientId = existingClient[0].id;
            console.log(`   ✅ Найден существующий Telegram клиент: ${clientId}`);
            
            // Обновляем имя если оно изменилось
            if (clientName && clientName !== 'Unknown') {
              await sql`
                UPDATE clients 
                SET name = ${clientName}, updated_at = NOW()
                WHERE id = ${clientId}
              `;
            }
          } else {
            // Создаем нового Telegram клиента
            const newClient = await sql`
              INSERT INTO clients (name, telegram_username, email, created_at, updated_at)
              VALUES (${clientName}, ${clientTelegram}, ${clientEmail}, NOW(), NOW())
              RETURNING id
            `;
            clientId = newClient[0].id;
            console.log(`   ✅ Создан новый Telegram клиент: ${clientId}`);
          }
        } else {
          // Нет ни телефона, ни Telegram username - это Telegram клиент (создан без телефона)
          console.log(`   ✈️  Telegram клиент (без телефона): ${clientName}`);
          
          // Определяем канал как telegram
          if (channel === 'unknown') {
            channel = 'telegram';
          }
          
          // Ищем клиента по имени (может быть дубликат, но это лучше чем создавать нового каждый раз)
          const existingClient = await sql`
            SELECT id FROM clients 
            WHERE name = ${clientName} 
              AND phone IS NULL 
              AND telegram_username IS NULL
            LIMIT 1
          `;
          
          if (existingClient.length > 0) {
            clientId = existingClient[0].id;
            console.log(`   ✅ Найден существующий Telegram клиент (без телефона): ${clientId}`);
            
            // Обновляем имя если оно изменилось
            if (clientName && clientName !== 'Unknown') {
              await sql`
                UPDATE clients 
                SET name = ${clientName}, updated_at = NOW()
                WHERE id = ${clientId}
              `;
            }
          } else {
            // Создаем нового Telegram клиента без телефона
            const newClient = await sql`
              INSERT INTO clients (name, email, created_at, updated_at)
              VALUES (${clientName}, ${clientEmail}, NOW(), NOW())
              RETURNING id
            `;
            clientId = newClient[0].id;
            console.log(`   ✅ Создан новый Telegram клиент (без телефона): ${clientId}`);
          }
        }
        
        // 3. Создать или обновить conversation
        // Добавляем metadata с информацией о парсинге
        const metadata = {
          incomplete: incomplete,
          loaded: messageCount,
          total: total,
          client_name: clientName,
          last_sync: new Date().toISOString()
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
            ${chat.id},
            ${channel || 'unknown'},
            ${channelAccount || null},
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
        console.log(`   ✅ Conversation создан/обновлен: ${conversationId}` +
          (incomplete ? ' ⚠️ INCOMPLETE' : ''));
        
        // 5. Сохранить сообщения
        let savedMessages = 0;
        if (messages && messages.length > 0) {
          for (const msg of messages) {
            try {
              // Определяем direction: incoming = от клиента, outgoing = к клиенту
              const direction = msg.type === 'incoming' || msg.direction === 'incoming' ? 'incoming' : 'outgoing';
              
              // Определяем channel (может быть в сообщении или берем из conversation)
              const msgChannel = msg.channel || channel;
              
              // Парсим дату (формат может быть "DD.MM.YYYY HH:mm" или ISO)
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
                    // ISO формат
                    sentAt = new Date(dateStr);
                  } else {
                    // Пробуем стандартный парсинг
                    sentAt = new Date(dateStr);
                  }
                  
                  // Проверяем валидность
                  if (isNaN(sentAt.getTime())) {
                    throw new Error('Invalid date');
                  }
                } catch (e) {
                  console.warn(`   ⚠️  Не удалось распарсить дату: ${msg.datetime}, используем текущую дату`);
                  sentAt = new Date();
                }
              } else if (msg.sent_at) {
                sentAt = new Date(msg.sent_at);
                if (isNaN(sentAt.getTime())) {
                  sentAt = new Date();
                }
              }
              
              // Получаем umnico_message_id если есть
              const umnicoMessageId = msg.id || msg.umnico_message_id || null;
              
              // Если есть umnico_message_id, используем ON CONFLICT
              // Если нет - просто вставляем (может быть дубликат, но это нормально для NULL)
              if (umnicoMessageId) {
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
                    ${msgChannel},
                    ${msg.text || ''},
                    ${sentAt},
                    ${umnicoMessageId},
                    ${JSON.stringify(msg.attachments || [])},
                    ${JSON.stringify({
                      author: msg.author || null,
                      ...(msg.metadata || {})
                    })},
                    NOW()
                  )
                  ON CONFLICT (umnico_message_id) DO NOTHING
                `;
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
                      ${msgChannel},
                      ${msg.text || ''},
                      ${sentAt},
                      NULL,
                      ${JSON.stringify(msg.attachments || [])},
                      ${JSON.stringify({
                        author: msg.author || null,
                        ...(msg.metadata || {})
                      })},
                      NOW()
                    )
                  `;
                }
              }
              
              savedMessages++;
            } catch (msgError) {
              console.warn(`   ⚠️  Ошибка сохранения сообщения:`, msgError.message);
            }
          }
          console.log(`   ✅ Сохранено сообщений: ${savedMessages}/${messageCount}`);
        } else {
          console.warn(`   ⚠️  Нет сообщений для сохранения (messageCount: ${messageCount})`);
        }
        
        // 7. Получить реальное количество сохраненных сообщений из БД
        const actualMessagesCount = await sql`
          SELECT COUNT(*) as count
          FROM messages
          WHERE conversation_id = ${conversationId}
        `;
        const realMessagesCount = parseInt(actualMessagesCount[0].count || 0);
        
        // 8. Отметить как обработанный (или необработанный если требуется ручная обработка)
        const shouldMarkAsProcessed = !needsManualProcessing; // Если требуется ручная обработка - не помечаем как обработанный
        
        await sql`
          UPDATE umnico_chat_ids
          SET 
            processed = ${shouldMarkAsProcessed},
            last_sync_at = NOW(),
            metadata = ${JSON.stringify({
              messages_count: realMessagesCount, // Используем реальное количество из БД
              messages_reported: messageCount, // Количество которое вернул API
              messages_saved: savedMessages, // Количество сохраненных в этом раунде
              needs_manual_processing: needsManualProcessing, // Требуется ручная обработка через MCP Chrome (30/30 = лимит страницы)
              client_id: clientId,
              client_name: clientName || null,
              client_phone: clientPhone || null,
              conversation_id: conversationId,
              channel: channel || 'unknown'
            })}
          WHERE id = ${chat.id}
        `;
        
        if (needsManualProcessing) {
          console.warn(`   ⚠️  Чат помечен как НЕОБРАБОТАННЫЙ для ручной обработки через MCP Chrome`);
        }
        
        processed++;
        console.log(`   ✅ Чат обработан успешно (${processed}/${pendingIds.length})`);
        
        // Задержка между запросами
        if (processed < pendingIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
        
      } catch (error) {
        failed++;
        console.error(`   ❌ Ошибка обработки чата ${chat.id}:`, error.message);
        
        // Помечаем как обработанный с ошибкой
        await sql`
          UPDATE umnico_chat_ids
          SET 
            processed = TRUE,
            last_sync_at = NOW(),
            metadata = ${JSON.stringify({
              error: error.message,
              failed_at: new Date().toISOString()
            })}
          WHERE id = ${chat.id}
        `;
      }
    }
    
    console.log(`\n\n✅ Синхронизация завершена:`);
    console.log(`   Успешно: ${processed}`);
    console.log(`   Ошибок: ${failed}`);
    
    // Показать общую статистику
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log(`\n📊 Общая статистика:`);
    console.log(`   Всего ID: ${stats[0].total}`);
    console.log(`   Обработано: ${stats[0].processed}`);
    console.log(`   Осталось: ${stats[0].pending}\n`);
    
    if (parseInt(stats[0].pending) > 0) {
      console.log('💡 Запустите скрипт снова для обработки оставшихся чатов');
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

syncConversations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

