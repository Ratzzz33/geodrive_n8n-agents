#!/usr/bin/env node

/**
 * Парсинг содержания переписки для ВСЕХ необработанных ID из umnico_chat_ids
 * 
 * Использование:
 *   node setup/parse_all_pending_umnico_ids.mjs
 *   node setup/parse_all_pending_umnico_ids.mjs --limit 100
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config();

const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';
const BATCH_SIZE = 10; // Обрабатываем по 10 чатов за раз
const DELAY_BETWEEN_BATCHES = 5000; // 5 секунд между батчами
const DELAY_BETWEEN_REQUESTS = 2000; // 2 секунды между запросами

// Парсинг аргументов
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

console.log('🔄 Запуск парсинга содержания переписки для всех необработанных ID...\n');
console.log(`   Playwright Service: ${PLAYWRIGHT_SERVICE_URL}`);
if (limit) {
  console.log(`   Лимит обработки: ${limit} ID\n`);
} else {
  console.log(`   Обработка всех необработанных ID\n`);
}

async function parseAllPendingIds() {
  try {
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalMessagesAdded = 0;
    
    while (true) {
      // Получаем необработанные ID
      let query = sql`
        SELECT id, discovered_at
        FROM umnico_chat_ids
        WHERE processed = FALSE
        ORDER BY discovered_at DESC
      `;
      
      if (limit) {
        query = sql`
          SELECT id, discovered_at
          FROM umnico_chat_ids
          WHERE processed = FALSE
          ORDER BY discovered_at DESC
          LIMIT ${limit - totalProcessed}
        `;
      } else {
        query = sql`
          SELECT id, discovered_at
          FROM umnico_chat_ids
          WHERE processed = FALSE
          ORDER BY discovered_at DESC
          LIMIT ${BATCH_SIZE}
        `;
      }
      
      const pendingIds = await query;
      
      if (pendingIds.length === 0) {
        console.log('\n✅ Все необработанные чаты обработаны!');
        break;
      }
      
      console.log(`\n📦 Батч: ${pendingIds.length} необработанных ID`);
      console.log(`   Всего обработано: ${totalProcessed}, ошибок: ${totalFailed}, пропущено: ${totalSkipped}\n`);
      
      for (const chat of pendingIds) {
        try {
          console.log(`\n🔍 [${totalProcessed + totalFailed + totalSkipped + 1}] Чат ID: ${chat.id}`);
          
          // 1. Получить сообщения
          console.log('   📥 Получение сообщений...');
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
          
          const messages = messagesData.data || [];
          const messageCount = messagesData.count || messages.length;
          const total = messagesData.total;
          const incomplete = messagesData.incomplete || false;
          const clientPhone = messagesData.clientPhone;
          const clientTelegram = messagesData.clientTelegram;
          const channel = messagesData.channel || 'unknown';
          const channelAccount = messagesData.channelAccount;
          
          if (messageCount === 0) {
            console.log('   ⚠️  Нет сообщений, пропускаем');
            await sql`
              UPDATE umnico_chat_ids
              SET processed = TRUE, last_sync_at = NOW()
              WHERE id = ${chat.id}
            `;
            totalSkipped++;
            continue;
          }
          
          console.log(`   ✅ Получено ${messageCount} сообщений${total ? ` из ${total}` : ''}${incomplete ? ' (неполная выборка)' : ''}`);
          console.log(`   📱 Канал: ${channel}${channelAccount ? ` (${channelAccount})` : ''}`);
          if (clientPhone) console.log(`   📞 Телефон: ${clientPhone}`);
          if (clientTelegram) console.log(`   💬 Telegram: ${clientTelegram}`);
          
          // 2. Найти или создать клиента
          let clientId = null;
          
          if (clientPhone) {
            const normalizedPhone = clientPhone.replace(/\D/g, '');
            const existingClient = await sql`
              SELECT id FROM clients WHERE phone = ${normalizedPhone} LIMIT 1
            `;
            
            if (existingClient.length > 0) {
              clientId = existingClient[0].id;
              console.log(`   👤 Найден клиент: ${clientId}`);
            } else {
              // Создаем нового клиента
              const newClient = await sql`
                INSERT INTO clients (phone, telegram_username)
                VALUES (${normalizedPhone}, ${clientTelegram || null})
                RETURNING id
              `;
              clientId = newClient[0].id;
              console.log(`   👤 Создан новый клиент: ${clientId}`);
            }
          } else if (clientTelegram) {
            const existingClient = await sql`
              SELECT id FROM clients WHERE telegram_username = ${clientTelegram} LIMIT 1
            `;
            
            if (existingClient.length > 0) {
              clientId = existingClient[0].id;
              console.log(`   👤 Найден клиент по Telegram: ${clientId}`);
            } else {
              const newClient = await sql`
                INSERT INTO clients (telegram_username)
                VALUES (${clientTelegram})
                RETURNING id
              `;
              clientId = newClient[0].id;
              console.log(`   👤 Создан новый клиент по Telegram: ${clientId}`);
            }
          }
          
          // 3. Найти или создать диалог
          let conversationId = null;
          const existingConv = await sql`
            SELECT id FROM conversations
            WHERE umnico_conversation_id = ${chat.id}
            LIMIT 1
          `;
          
          if (existingConv.length > 0) {
            conversationId = existingConv[0].id;
            console.log(`   💬 Найден диалог: ${conversationId}`);
          } else {
            if (!clientId) {
              // Создаем клиента без данных
              const newClient = await sql`
                INSERT INTO clients (phone)
                VALUES (NULL)
                RETURNING id
              `;
              clientId = newClient[0].id;
            }
            
            const newConv = await sql`
              INSERT INTO conversations (
                client_id,
                umnico_conversation_id,
                channel,
                channel_account,
                status,
                last_message_at
              )
              VALUES (
                ${clientId},
                ${chat.id},
                ${channel},
                ${channelAccount || null},
                'active',
                NOW()
              )
              RETURNING id
            `;
            conversationId = newConv[0].id;
            console.log(`   💬 Создан новый диалог: ${conversationId}`);
          }
          
          // 4. Сохранить сообщения
          let messagesAdded = 0;
          for (const msg of messages) {
            try {
              const umnicoMessageId = msg.id || msg.umnico_message_id || null;
              const direction = msg.direction === 'incoming' || msg.direction === 'in' ? 'incoming' : 'outgoing';
              const sentAt = msg.sent_at || msg.timestamp || msg.created_at || new Date();
              const text = msg.text || msg.message || '';
              
              if (umnicoMessageId) {
                await sql`
                  INSERT INTO messages (
                    conversation_id,
                    client_id,
                    direction,
                    channel,
                    text,
                    sent_at,
                    umnico_message_id
                  )
                  VALUES (
                    ${conversationId},
                    ${clientId},
                    ${direction},
                    ${channel},
                    ${text},
                    ${sentAt},
                    ${umnicoMessageId}
                  )
                  ON CONFLICT (umnico_message_id) DO NOTHING
                `;
                messagesAdded++;
              } else {
                // Если нет umnico_message_id, вставляем без UNIQUE constraint
                await sql`
                  INSERT INTO messages (
                    conversation_id,
                    client_id,
                    direction,
                    channel,
                    text,
                    sent_at
                  )
                  VALUES (
                    ${conversationId},
                    ${clientId},
                    ${direction},
                    ${channel},
                    ${text},
                    ${sentAt}
                  )
                `;
                messagesAdded++;
              }
            } catch (error) {
              console.error(`   ⚠️  Ошибка сохранения сообщения: ${error.message}`);
            }
          }
          
          // 5. Обновить диалог
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const lastMessageAt = lastMessage.sent_at || lastMessage.timestamp || lastMessage.created_at || new Date();
            
            await sql`
              UPDATE conversations
              SET 
                last_message_at = ${lastMessageAt},
                updated_at = NOW()
              WHERE id = ${conversationId}
            `;
          }
          
          // 6. Пометить как обработанный
          await sql`
            UPDATE umnico_chat_ids
            SET processed = TRUE, last_sync_at = NOW()
            WHERE id = ${chat.id}
          `;
          
          console.log(`   ✅ Сохранено ${messagesAdded} сообщений`);
          totalProcessed++;
          totalMessagesAdded += messagesAdded;
          
          // Задержка между запросами
          if (pendingIds.indexOf(chat) < pendingIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }
          
        } catch (error) {
          console.error(`   ❌ Ошибка обработки чата ${chat.id}:`, error.message);
          totalFailed++;
          
          // Помечаем как обработанный с ошибкой (чтобы не зациклиться)
          const errorMetadata = {
            error: error.message,
            failed_at: new Date().toISOString()
          };
          await sql`
            UPDATE umnico_chat_ids
            SET 
              processed = TRUE, 
              last_sync_at = NOW(), 
              metadata = ${JSON.stringify(errorMetadata)}::jsonb
            WHERE id = ${chat.id}
          `;
        }
      }
      
      // Задержка между батчами
      if (pendingIds.length === BATCH_SIZE && (!limit || totalProcessed < limit)) {
        console.log(`\n⏳ Пауза ${DELAY_BETWEEN_BATCHES / 1000} сек перед следующим батчем...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
      
      // Если достигли лимита, выходим
      if (limit && totalProcessed >= limit) {
        console.log(`\n✅ Достигнут лимит обработки: ${limit} ID`);
        break;
      }
    }
    
    // Финальная статистика
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(60));
    console.log(`✅ Обработано чатов: ${totalProcessed}`);
    console.log(`❌ Ошибок: ${totalFailed}`);
    console.log(`⏭️  Пропущено: ${totalSkipped}`);
    console.log(`💬 Сохранено сообщений: ${totalMessagesAdded}`);
    console.log('\n📊 Статистика БД:');
    console.log(`   Всего ID в БД: ${stats[0].total}`);
    console.log(`   Обработано: ${stats[0].processed}`);
    console.log(`   Ожидает обработки: ${stats[0].pending}`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

parseAllPendingIds().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

