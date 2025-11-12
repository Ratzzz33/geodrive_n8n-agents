#!/usr/bin/env node

/**
 * Сохранение данных диалога в БД
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

// Данные из первого диалога (61006882)
const dialogData = {
  conversationId: '61006882',
  messages: [
    // ... данные из MCP Chrome
  ],
  loaded: 92, // после прокрутки
  clientPhone: null,
  clientTelegram: null,
  channel: 'telegram',
  channelAccount: ''
};

console.log('Сохранение данных диалога в БД...');

// TODO: Реализовать сохранение

await sql.end();

