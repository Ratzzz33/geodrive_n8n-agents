#!/usr/bin/env node

/**
 * Сохранение 90 диалогов (x=y) в БД через Playwright Service
 * 
 * Использует существующий Playwright сервис для получения данных
 * и сохраняет их в БД с правильной обработкой клиентов и сообщений
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

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://46.224.17.15:3001';
const DELAY_BETWEEN_REQUESTS = 2000; // 2 секунды между запросами

console.log('🔄 Сохранение 90 диалогов (x=y) в БД...\n');

async function saveDialogs() {
  try {
    // 1. Читаем ID из файла
    console.log('📂 Чтение dialog_ids_list.txt...');
    const fileContent = readFileSync('dialog_ids_list.txt', 'utf8');
    const idsMatch = fileContent.match(/📋 Список ID:\s*\n([\d,\s]+)/);
    const dialogIds = idsMatch 
      ? idsMatch[1].split(',').map(id => id.trim()).filter(Boolean)
      : [];
    
    console.log(`✅ Прочитано ${dialogIds.length} ID\n`);
    
    // Статистика
    let processed = 0;
    let failed = 0;
    let totalMessagesAdded = 0;
    let newConversations = 0;
    let updatedConversations = 0;
    
    // Обрабатываем каждый диалог
    for (const umnicoId of dialogIds) {
      try {
        const idStr = String(umnicoId);
        console.log(`\n🔍 [${processed + failed + 1}/${dialogIds.length}] Диалог ID: ${idStr}`);
        
        // Проверяем, есть ли уже диалог в БД
        const existingConv = await sql`
          SELECT id, client_id, channel, metadata
          FROM conversations
          WHERE umnico_conversation_id = ${idStr}
          LIMIT 1
        `;
        
        const isNew = existingConv.length === 0;
        if (isNew) {
          console.log(`   🆕 Новый диалог (нет в БД)`);
          newConversations++;
        } else {
          console.log(`   📝 Существующий диалог`);
          updatedConversations++;
        }
        
        // 1. Получить сообщения через Playwright Service
        console.log('   📥 Получение сообщений через Playwright Service...');
        let messagesResponse;
        try {
          messagesResponse = await fetch(
            `${PLAYWRIGHT_SERVICE_URL}/api/conversations/${idStr}/messages`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              timeout: 60000
            }
          );
        } catch (fetchError) {
          console.log(`   ⚠️  Ошибка подключения к Playwright Service: ${fetchError.message}`);
          console.log(`   💡 Проверьте, что Playwright сервис запущен на ${PLAYWRIGHT_SERVICE_URL}`);
          failed++;
          continue;
        }
        
        if (!messagesResponse.ok) {
          const errorText = await messagesResponse.text();
          console.log(`   ⚠️  Ошибка получения сообщений: ${messagesResponse.status} - ${errorText}`);
          failed++;
          continue;
        }
        
        const messagesData = await messagesResponse.json();
        
        if (!messagesData || messagesData.error || !messagesData.ok) {
          console.log(`   ⚠️  Ошибка в ответе: ${messagesData?.error || messagesData?.message || 'Unknown error'}`);
          failed++;
          continue;
        }
        
        // Формат ответа от Playwright Service V2
        const messages = messagesData.data || messagesData.messages || [];
        const count = messagesData.count || messages.length;
        const total = messagesData.total || null;
        const incomplete = messagesData.incomplete || false;
        const clientPhone = messagesData.clientPhone || null;
        const clientTelegram = messagesData.clientTelegram || null;
        const channel = (messagesData.channel || 'unknown').toString();
        const channelAccount = messagesData.channelAccount ? messagesData.channelAccount.toString() : null;
        
        console.log(`   ✅ Получено ${messages.length} сообщений`);
        if (total) {
          console.log(`   📊 Всего сообщений: ${total}, Загружено: ${count}`);
        }
        if (incomplete) {
          console.log(`   ⚠️  Диалог помечен как incomplete`);
        }
        console.log(`   📱 Канал: ${channel}${channelAccount ? ` (${channelAccount})` : ''}`);
        console.log(`   👤 Клиент: ${clientPhone || clientTelegram || 'Unknown'}`);
        
        // 2. Найти или создать клиента
        let clientId = null;
        if (clientPhone) {
          const [client] = await sql`
            SELECT id FROM clients 
            WHERE phone = ${clientPhone} 
            LIMIT 1
          `;
          if (client) {
            clientId = client.id;
            console.log(`   👤 Найден клиент по телефону: ${clientPhone}`);
          } else {
            const [newClient] = await sql`
              INSERT INTO clients (phone, name)
              VALUES (${clientPhone}, 'Unknown')
              RETURNING id
            `;
            clientId = newClient.id;
            console.log(`   👤 Создан новый клиент по телефону: ${clientPhone}`);
          }
        } else if (clientTelegram) {
          const [client] = await sql`
            SELECT id FROM clients 
            WHERE telegram_username = ${clientTelegram} 
            LIMIT 1
          `;
          if (client) {
            clientId = client.id;
            console.log(`   👤 Найден клиент по Telegram: ${clientTelegram}`);
          } else {
            const [newClient] = await sql`
              INSERT INTO clients (telegram_username, name)
              VALUES (${clientTelegram}, 'Unknown')
              RETURNING id
            `;
            clientId = newClient.id;
            console.log(`   👤 Создан новый клиент по Telegram: ${clientTelegram}`);
          }
        }
        
        // 3. Найти или создать conversation
        let convId = null;
        const metadata = {
          loaded: count || messages.length,
          total: total || null,
          incomplete: incomplete || false,
          client_phone: clientPhone || null,
          client_telegram: clientTelegram || null,
          channel_account: (channelAccount || '').toString()
        };
        
        if (existingConv.length > 0) {
          convId = existingConv[0].id;
          // Обновить метаданные
          await sql`
            UPDATE conversations
            SET 
              metadata = ${JSON.stringify(metadata)}::jsonb,
              channel = ${(channel || 'unknown')},
              updated_at = now()
            WHERE id = ${convId}
          `;
          console.log(`   📝 Обновлен conversation в БД`);
        } else {
          const [newConv] = await sql`
            INSERT INTO conversations (
              umnico_conversation_id,
              client_id,
              channel,
              metadata
            )
            VALUES (
              ${idStr},
              ${clientId},
              ${(channel || 'unknown')},
              ${JSON.stringify(metadata)}::jsonb
            )
            RETURNING id
          `;
          convId = newConv.id;
          console.log(`   ✅ Создан новый conversation в БД`);
        }
        
        // 4. Сохранить сообщения
        let savedCount = 0;
        let skippedCount = 0;
        for (const msg of messages) {
          try {
            // Используем datetime как umnico_message_id, если нет - используем комбинацию
            const messageId = msg.datetime || `${idStr}_${savedCount}_${Date.now()}`;
            
            await sql`
              INSERT INTO messages (
                conversation_id,
                umnico_message_id,
                text,
                direction,
                sent_at,
                metadata
              )
              VALUES (
                ${convId},
                ${messageId},
                ${(msg.text || '')},
                ${(msg.direction || 'incoming')},
                ${msg.datetime ? new Date(msg.datetime) : null},
                ${JSON.stringify({
                  time: msg.time || '',
                  hasAttachments: msg.hasAttachments || false
                })}::jsonb
              )
              ON CONFLICT (conversation_id, umnico_message_id) 
              DO UPDATE SET
                text = EXCLUDED.text,
                direction = EXCLUDED.direction,
                sent_at = EXCLUDED.sent_at
            `;
            savedCount++;
          } catch (err) {
            // Игнорируем ошибки дубликатов и другие некритичные ошибки
            if (err.message.includes('duplicate') || err.message.includes('unique')) {
              skippedCount++;
            } else {
              console.error(`   ⚠️  Ошибка сохранения сообщения: ${err.message}`);
            }
          }
        }
        
        totalMessagesAdded += savedCount;
        console.log(`   ✅ Сохранено: ${savedCount} сообщений${skippedCount > 0 ? `, пропущено (дубликаты): ${skippedCount}` : ''}`);
        processed++;
        
        // Задержка между запросами
        if (processed < dialogIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
        
      } catch (error) {
        console.error(`   ❌ Ошибка при обработке диалога ${umnicoId}:`, error.message);
        failed++;
      }
    }
    
    // Итоговая статистика
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(60));
    console.log(`✅ Успешно обработано: ${processed}`);
    console.log(`❌ Ошибок: ${failed}`);
    console.log(`🆕 Новых диалогов: ${newConversations}`);
    console.log(`📝 Обновлено диалогов: ${updatedConversations}`);
    console.log(`✉️  Всего сообщений сохранено: ${totalMessagesAdded}`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  } finally {
    await sql.end();
  }
}

saveDialogs().catch(console.error);

