#!/usr/bin/env node

/**
 * Парсинг всех диалогов x=y через MCP Chrome
 * 
 * ВАЖНО: Этот скрипт должен выполняться агентом с доступом к MCP Chrome инструментам
 */

import { readFileSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

const UMNICO_EMAIL = 'geodrive.ge@gmail.com';
const UMNICO_PASSWORD = '2GeoDriveumnicopassword!!))';

// Читаем список ID
const idsContent = readFileSync('dialog_ids_list.txt', 'utf8');
const idsMatch = idsContent.match(/📋 Список ID:\s*\n([\d,\s]+)/);
const dialogIds = idsMatch 
  ? idsMatch[1].split(',').map(id => id.trim()).filter(Boolean)
  : [];

console.log(`\n🚀 Парсинг ${dialogIds.length} диалогов через MCP Chrome\n`);
console.log(`📋 ID: ${dialogIds.join(', ')}\n`);

// Этот скрипт будет использовать MCP Chrome инструменты
// Но так как они доступны только в контексте агента,
// нужно выполнять парсинг интерактивно

console.log('⚠️  Для выполнения парсинга через MCP Chrome:');
console.log('   1. Агент должен использовать MCP Chrome инструменты');
console.log('   2. Для каждого диалога: навигация → парсинг → сохранение');
console.log('   3. Применение логики x/y с прокруткой при необходимости\n');

await sql.end();

