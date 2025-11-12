#!/usr/bin/env node

/**
 * Сохранение данных диалогов, спарсенных через MCP Chrome, в БД
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

// Данные для сохранения (будут заполняться из MCP Chrome)
const parsedDialogs = [
  // Пример структуры:
  // {
  //   conversationId: '61006882',
  //   messages: [...],
  //   loaded: 92,
  //   clientPhone: null,
  //   clientTelegram: null,
  //   channel: 'telegram',
  //   channelAccount: ''
  // }
];

async function saveDialog(dialogData) {
  try {
    const { conversationId, messages, loaded, clientPhone, clientTelegram, channel, channelAccount } = dialogData;
    
    console.log(`\n💾 Сохранение диалога ${conversationId}...`);
    console.log(`   Сообщений: ${messages.length}`);
    console.log(`   Канал: ${channel}`);
    console.log(`   Клиент: ${clientPhone || clientTelegram || 'Unknown'}`);
    
    // Найти или создать клиента
    let clientId = null;
    if (clientPhone) {
      const [client] = await sql`
        SELECT id FROM clients 
        WHERE phone = ${clientPhone} 
        LIMIT 1
      `;
      if (client) {
        clientId = client.id;
      } else {
        const [newClient] = await sql`
          INSERT INTO clients (phone, name)
          VALUES (${clientPhone}, 'Unknown')
          RETURNING id
        `;
        clientId = newClient.id;
      }
    } else if (clientTelegram) {
      const [client] = await sql`
        SELECT id FROM clients 
        WHERE telegram_username = ${clientTelegram} 
        LIMIT 1
      `;
      if (client) {
        clientId = client.id;
      } else {
        const [newClient] = await sql`
          INSERT INTO clients (telegram_username, name)
          VALUES (${clientTelegram}, 'Unknown')
          RETURNING id
        `;
        clientId = newClient.id;
      }
    }
    
    // Найти или создать conversation
    const [conversation] = await sql`
      SELECT id FROM conversations 
      WHERE umnico_conversation_id = ${conversationId}
      LIMIT 1
    `;
    
    let convId = null;
    if (conversation) {
      convId = conversation.id;
      // Обновить метаданные
      await sql`
        UPDATE conversations
        SET 
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{loaded}',
            ${loaded}::text::jsonb
          ),
          channel = ${channel || 'unknown'},
          updated_at = now()
        WHERE id = ${convId}
      `;
    } else {
      const [newConv] = await sql`
        INSERT INTO conversations (
          umnico_conversation_id,
          client_id,
          channel,
          metadata
        )
        VALUES (
          ${conversationId},
          ${clientId},
          ${channel || 'unknown'},
          jsonb_build_object(
            'loaded', ${loaded},
            'total', null,
            'incomplete', false,
            'client_phone', ${clientPhone},
            'client_telegram', ${clientTelegram},
            'channel_account', ${channelAccount || ''}
          )
        )
        RETURNING id
      `;
      convId = newConv.id;
    }
    
    // Сохранить сообщения
    let savedCount = 0;
    for (const msg of messages) {
      try {
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
            ${msg.datetime || null},
            ${msg.text || ''},
            ${msg.direction || 'incoming'},
            ${msg.datetime ? new Date(msg.datetime) : null},
            jsonb_build_object(
              'time', ${msg.time || ''},
              'hasAttachments', ${msg.hasAttachments || false}
            )
          )
          ON CONFLICT (conversation_id, umnico_message_id) 
          DO UPDATE SET
            text = EXCLUDED.text,
            direction = EXCLUDED.direction,
            sent_at = EXCLUDED.sent_at
        `;
        savedCount++;
      } catch (err) {
        console.error(`   ⚠️  Ошибка сохранения сообщения: ${err.message}`);
      }
    }
    
    console.log(`   ✅ Сохранено: ${savedCount} сообщений`);
    
  } catch (error) {
    console.error(`❌ Ошибка сохранения диалога: ${error.message}`);
    throw error;
  }
}

// Экспорт функции для использования в других скриптах
export { saveDialog };

// Если запущен напрямую - пример использования
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('📝 Скрипт для сохранения данных диалогов в БД');
  console.log('   Используйте функцию saveDialog() для сохранения каждого диалога\n');
  
  await sql.end();
}

