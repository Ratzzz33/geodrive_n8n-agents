#!/usr/bin/env node
/**
 * Скачивание скриптов авторизации Starline из GitLab
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'https://gitlab.com/starline/openapi/-/raw/master';

const scripts = [
  'get_app_code.py',
  'get_app_token.py',
  'get_slid_user_token.py',
  'get_slnet_token.py'
];

async function downloadScripts() {
  console.log('📥 Скачиваю скрипты авторизации Starline...\n');

  for (const script of scripts) {
    try {
      console.log(`   Скачиваю ${script}...`);
      const response = await fetch(`${BASE_URL}/${script}`);
      
      if (!response.ok) {
        throw new Error(`Failed to download ${script}: ${response.status}`);
      }

      const content = await response.text();
      const filePath = join(__dirname, script);
      writeFileSync(filePath, content, 'utf8');
      console.log(`   ✅ ${script} сохранен\n`);
    } catch (error) {
      console.error(`   ❌ Ошибка при скачивании ${script}: ${error.message}\n`);
    }
  }

  console.log('✅ Все скрипты скачаны!\n');
}

downloadScripts();

