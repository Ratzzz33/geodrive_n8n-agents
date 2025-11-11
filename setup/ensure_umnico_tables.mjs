#!/usr/bin/env node

/**
 * Проверка и создание таблиц для синхронизации Umnico
 * 
 * Использование:
 * node setup/ensure_umnico_tables.mjs
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function ensureTables() {
  try {
    console.log('🔍 Проверка таблиц для синхронизации Umnico...\n');
    
    // 1. Проверка таблицы umnico_chat_ids
    console.log('1️⃣ Проверка umnico_chat_ids...');
    const chatIdsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'umnico_chat_ids'
      )
    `;
    
    if (!chatIdsExists[0].exists) {
      console.log('   ⚠️  Таблица не найдена, создаю...');
      await sql`
        CREATE TABLE umnico_chat_ids (
          id TEXT PRIMARY KEY,
          discovered_at TIMESTAMPTZ DEFAULT NOW(),
          source TEXT,
          processed BOOLEAN DEFAULT FALSE,
          last_sync_at TIMESTAMPTZ,
          metadata JSONB
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_umnico_chat_ids_processed 
        ON umnico_chat_ids(processed) 
        WHERE processed = FALSE
      `;
      console.log('   ✅ Таблица umnico_chat_ids создана');
    } else {
      console.log('   ✅ Таблица umnico_chat_ids существует');
    }
    
    // 2. Проверка таблицы clients
    console.log('\n2️⃣ Проверка clients...');
    const clientsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clients'
      )
    `;
    
    if (!clientsExists[0].exists) {
      console.log('   ⚠️  Таблица не найдена, создаю...');
      await sql`
        CREATE TABLE clients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT,
          phone TEXT,
          email TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)`;
      console.log('   ✅ Таблица clients создана');
    } else {
      console.log('   ✅ Таблица clients существует');
    }
    
    // 3. Проверка таблицы conversations
    console.log('\n3️⃣ Проверка conversations...');
    const conversationsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'conversations'
      )
    `;
    
    if (!conversationsExists[0].exists) {
      console.log('   ⚠️  Таблица не найдена, применяю схему...');
      const schemaPath = join(__dirname, '..', 'sql', 'conversations_schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      
      // Выполняем только часть схемы для conversations
      await sql`
        CREATE TABLE conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          umnico_conversation_id TEXT UNIQUE,
          amocrm_scope_id TEXT,
          channel TEXT,
          channel_account TEXT,
          status TEXT DEFAULT 'active',
          assigned_to_user_id INTEGER,
          last_message_at TIMESTAMPTZ,
          last_message_preview TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversations_umnico ON conversations(umnico_conversation_id) WHERE umnico_conversation_id IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`;
      console.log('   ✅ Таблица conversations создана');
    } else {
      console.log('   ✅ Таблица conversations существует');
    }
    
    // 4. Проверка таблицы messages
    console.log('\n4️⃣ Проверка messages...');
    const messagesExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      )
    `;
    
    if (!messagesExists[0].exists) {
      console.log('   ⚠️  Таблица не найдена, создаю...');
      await sql`
        CREATE TABLE messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          booking_id UUID,
          direction TEXT NOT NULL,
          channel TEXT NOT NULL,
          text TEXT,
          attachments JSONB DEFAULT '[]'::jsonb,
          sent_at TIMESTAMPTZ NOT NULL,
          read_at TIMESTAMPTZ,
          umnico_message_id TEXT UNIQUE,
          amocrm_note_id TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now(),
          CONSTRAINT valid_direction CHECK (direction IN ('incoming', 'outgoing'))
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_messages_umnico ON messages(umnico_message_id) WHERE umnico_message_id IS NOT NULL`;
      console.log('   ✅ Таблица messages создана');
    } else {
      console.log('   ✅ Таблица messages существует');
    }
    
    console.log('\n✅ Все таблицы готовы для синхронизации!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

ensureTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

