#!/usr/bin/env node

/**
 * Парсинг сообщений для ВСЕХ диалогов Umnico, которые уже есть в БД
 * 
 * Использует Playwright Service для получения полной истории каждого чата
 * Обновляет существующие диалоги и добавляет недостающие сообщения
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
const BATCH_SIZE = 10; // Обрабатываем по 10 чатов за раз
const DELAY_BETWEEN_REQUESTS = 2000; // 2 секунды между запросами

console.log('🔄 Запуск парсинга сообщений для всех диалогов Umnico из БД...\n');

async function parseAllConversations() {
  try {
    // Получаем ВСЕ диалоги из БД
    const allConversations = await sql`
      SELECT 
        id,
        umnico_conversation_id,
        client_id,
        client_name,
        channel,
        metadata
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC
    `;
    
    if (allConversations.length === 0) {
      console.log('❌ Диалоги не найдены в БД!');
      console.log('   Сначала запустите sync_umnico_conversations.mjs для создания диалогов');
      return;
    }
    
    console.log(`📋 Найдено диалогов в БД: ${allConversations.length}\n`);
    
    // Статистика
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    let totalMessagesAdded = 0;
    let incompleteCount = 0;
    
    // Обрабатываем батчами
    for (let i = 0; i < allConversations.length; i += BATCH_SIZE) {
      const batch = allConversations.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Обработка батча ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allConversations.length / BATCH_SIZE)} (${batch.length} диалогов)\n`);
      
      for (const conv of batch) {
        try {
          const umnicoId = conv.umnico_conversation_id;
          console.log(`\n🔍 [${processed + failed + skipped + 1}/${allConversations.length}] Диалог ID: ${umnicoId}`);
          console.log(`   Клиент: ${conv.client_name || 'Unknown'}`);
          console.log(`   Канал: ${conv.channel || 'unknown'}`);
          
          // 1. Получить сообщения (НОВАЯ ЛОГИКА V2)
          console.log('   📥 Получение сообщений (с умной логикой x/y)...');
          const messagesResponse = await fetch(
            `${PLAYWRIGHT_SERVICE_URL}/api/conversations/${umnicoId}/messages`
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
          const channel = messagesData.channel || conv.channel || 'unknown';
          const channelAccount = messagesData.channelAccount;
          
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
          
          // 2. Сохранить/обновить сообщения
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
                  ${conv.client_id},
                  ${conv.id},
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
                  })},
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
              
              if (result.length > 0 && result[0].id) {
                messagesUpdated++;
              } else {
                messagesAdded++;
              }
            } else {
              // Если нет ID, проверяем дубликат по conversation_id + sent_at + text
              const existing = await sql`
                SELECT id FROM messages 
                WHERE conversation_id = ${conv.id}
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
                    ${conv.client_id},
                    ${conv.id},
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
                    })},
                    NOW()
                  )
                `;
                messagesAdded++;
              } else {
                messagesUpdated++;
              }
            }
          }
          
          // 3. Обновить метаданные диалога
          const metadata = {
            ...(conv.metadata || {}),
            incomplete: incomplete,
            loaded: messageCount,
            total: total,
            last_sync: new Date().toISOString(),
            client_phone: clientPhone || null,
            client_telegram: clientTelegram || null,
            channel_account: channelAccount || null
          };
          
          await sql`
            UPDATE conversations
            SET
              channel = ${channel},
              metadata = ${JSON.stringify(metadata)}::jsonb,
              last_message_at = (
                SELECT MAX(sent_at) FROM messages WHERE conversation_id = ${conv.id}
              ),
              updated_at = NOW()
            WHERE id = ${conv.id}
          `;
          
          console.log(`   ✅ Сохранено: +${messagesAdded} новых, ~${messagesUpdated} обновлено`);
          totalMessagesAdded += messagesAdded;
          processed++;
          
        } catch (error) {
          console.error(`   ❌ Ошибка: ${error.message}`);
          failed++;
        }
        
        // Задержка между запросами
        if (processed + failed + skipped < allConversations.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
      }
      
      // Пауза между батчами
      if (i + BATCH_SIZE < allConversations.length) {
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
    console.log(`⏭️  Пропущено: ${skipped}`);
    console.log(`📨 Всего добавлено сообщений: ${totalMessagesAdded}`);
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
parseAllConversations()
  .then(() => {
    console.log('\n✅ Парсинг завершен!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Парсинг завершился с ошибкой:', error);
    process.exit(1);
  });

