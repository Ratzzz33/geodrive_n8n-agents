#!/usr/bin/env node

/**
 * Сохранение батча спарсенных диалогов в БД
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

// Данные из последнего парсинга (нужно будет заполнить)
const parsedDialogs = [
  // Будут добавлены из результатов MCP Chrome
];

async function saveDialog(dialogData) {
  try {
    const { conversationId, messages, loaded, total, incomplete, clientPhone, clientTelegram, channel, channelAccount } = dialogData;
    
    console.log(`\n💾 Сохранение диалога ${conversationId}...`);
    console.log(`   Сообщений: ${messages?.length || 0}`);
    console.log(`   Загружено: ${loaded || 0}`);
    console.log(`   Канал: ${channel || 'unknown'}`);
    
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
    const metadata = {
      loaded: loaded || 0,
      total: total || null,
      incomplete: incomplete || false,
      client_phone: clientPhone || null,
      client_telegram: clientTelegram || null,
      channel_account: channelAccount || null
    };
    
    if (conversation) {
      convId = conversation.id;
      // Обновить метаданные
      await sql`
        UPDATE conversations
        SET 
          metadata = ${JSON.stringify(metadata)}::jsonb,
          channel = ${(channel || 'unknown')},
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
          ${(channel || 'unknown')},
          ${JSON.stringify(metadata)}::jsonb
        )
        RETURNING id
      `;
      convId = newConv.id;
    }
    
    // Сохранить сообщения
    if (messages && messages.length > 0) {
      let savedCount = 0;
      for (const msg of messages) {
        try {
          const messageId = msg.datetime || `${conversationId}_${savedCount}`;
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
          // Игнорируем ошибки дубликатов
          if (!err.message.includes('duplicate')) {
            console.error(`   ⚠️  Ошибка сохранения сообщения: ${err.message}`);
          }
        }
      }
      console.log(`   ✅ Сохранено: ${savedCount} сообщений`);
    } else {
      console.log(`   ⚠️  Нет сообщений для сохранения`);
    }
    
  } catch (error) {
    console.error(`❌ Ошибка сохранения диалога: ${error.message}`);
    throw error;
  }
}

// Сохранить все диалоги
async function saveAll() {
  for (const dialog of parsedDialogs) {
    await saveDialog(dialog);
    await new Promise(resolve => setTimeout(resolve, 100)); // Небольшая задержка
  }
  console.log(`\n✅ Все диалоги сохранены!`);
}

if (parsedDialogs.length > 0) {
  saveAll().then(() => sql.end()).catch(console.error);
} else {
  console.log('📝 Нет данных для сохранения. Добавьте данные в массив parsedDialogs.');
  sql.end();
}

