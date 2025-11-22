#!/usr/bin/env node
/**
 * Копирование src/api/index.ts на сервер
 */

import { readFileSync } from 'fs';
import { ServerSSH } from './server_ssh.js';

const content = readFileSync('src/api/index.ts', 'utf-8');

const ssh = new ServerSSH();
await ssh.connect();

// Разбиваем на части для избежания проблем с длинными строками
const lines = content.split('\n');
const chunkSize = 100;

for (let i = 0; i < lines.length; i += chunkSize) {
  const chunk = lines.slice(i, i + chunkSize).join('\n');
  const command = i === 0 
    ? `cat > /root/geodrive_n8n-agents/src/api/index.ts << 'EOFMARKER'\n${chunk}`
    : chunk;
  
  await ssh.execute(command);
}

// Закрываем маркер
await ssh.execute('EOFMARKER');

await ssh.close();

console.log('✅ Файл скопирован на сервер');

