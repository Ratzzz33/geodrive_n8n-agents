#!/usr/bin/env node

/**
 * Сохранение ID из результата браузера
 * Использование: передать массив ID через stdin
 */

import { writeFileSync } from 'fs';

// Вставьте сюда массив ID из браузера
const ids = process.argv[2] ? JSON.parse(process.argv[2]) : [];

if (ids.length === 0) {
  console.error('❌ Нет ID для сохранения');
  console.error('Использование: node save_ids_from_browser.mjs \'["id1","id2",...]\'');
  process.exit(1);
}

const data = {
  total: ids.length,
  collected_at: new Date().toISOString(),
  source: 'chrome_mcp_collection_extended',
  ids: ids
};

writeFileSync('umnico_chat_ids.json', JSON.stringify(data, null, 2));

console.log(`✅ Сохранено ${ids.length} ID в umnico_chat_ids.json`);

