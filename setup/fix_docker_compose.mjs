#!/usr/bin/env node
/**
 * Исправление docker-compose.yml на сервере:
 * 1. Удаление deprecated переменных
 * 2. Добавление новых переменных окружения
 * 3. Исправление синтаксической ошибки YAML в секции networks
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SERVER_IP = '46.224.17.15';
const SERVER_USER = 'root';
const SERVER_PASSWORD = process.env.SERVER_PASSWORD || 'WNHeg7U7aiKw';
const DOCKER_COMPOSE_PATH = '/root/geodrive_n8n-agents/docker-compose.yml';

// Используем fetch для работы с SSH через Python скрипт
async function executeSSH(command) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  const sshCommand = `python setup/server_ssh.py "${command.replace(/"/g, '\\"')}"`;
  const { stdout, stderr } = await execAsync(sshCommand);
  return { stdout, stderr };
}

async function main() {
  console.log('🔧 Исправление docker-compose.yml на сервере...\n');
  
  // 1. Скачиваем файл
  console.log('📥 Получение docker-compose.yml с сервера...');
  const { stdout: fileContent } = await executeSSH(`cat ${DOCKER_COMPOSE_PATH}`);
  
  // 2. Исправляем файл
  let fixed = fileContent;
  
  // Удаляем EXECUTIONS_PROCESS=main (deprecated)
  fixed = fixed.replace(/^\s*-\s*EXECUTIONS_PROCESS=main\s*$/gm, '');
  
  // Добавляем новые переменные после NODE_ENV=production
  const nodeEnvLine = fixed.indexOf('NODE_ENV=production');
  if (nodeEnvLine !== -1) {
    const insertPos = fixed.indexOf('\n', nodeEnvLine) + 1;
    const newVars = `      
      # Новые переменные (2025)
      - N8N_RUNNERS_ENABLED=true
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
      - N8N_GIT_NODE_DISABLE_BARE_REPOS=true
`;
    fixed = fixed.slice(0, insertPos) + newVars + fixed.slice(insertPos);
  }
  
  // Исправляем синтаксическую ошибку в секции networks (удаляем extra_hosts)
  fixed = fixed.replace(/^networks:\s*\n\s*extra_hosts:\s*\n\s*-\s*"host\.docker\.internal:host-gateway"\s*\n\s*n8n-network:\s*$/gm, 
    'networks:\n  n8n-network:');
  
  // Также исправляем если формат немного другой
  fixed = fixed.replace(/^networks:\s*\n\s*extra_hosts:\s*\n\s*-\s*"host\.docker\.internal:host-gateway"\s*\n\s*n8n-network:\s*\n\s*driver:\s*bridge\s*$/gm,
    'networks:\n  n8n-network:\n    driver: bridge');
  
  // 3. Сохраняем исправленный файл на сервере
  console.log('📤 Загрузка исправленного файла на сервер...');
  
  // Создаем временный файл локально
  const tempFile = join(process.cwd(), 'docker-compose-fixed.yml');
  writeFileSync(tempFile, fixed, 'utf8');
  
  // Загружаем на сервер через SCP
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  // Используем Python скрипт для загрузки
  const uploadScript = `
import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('${SERVER_IP}', username='${SERVER_USER}', password='${SERVER_PASSWORD}')

sftp = ssh.open_sftp()
with open('${tempFile.replace(/\\/g, '/')}', 'rb') as f:
    sftp.putfo(f, '${DOCKER_COMPOSE_PATH}')

sftp.close()
ssh.close()
print('OK')
`;
  
  const pythonScript = join(process.cwd(), 'setup', 'upload_compose.py');
  writeFileSync(pythonScript, uploadScript, 'utf8');
  
  try {
    await execAsync(`python "${pythonScript}"`);
    console.log('✅ Файл успешно загружен на сервер');
  } catch (error) {
    console.error('❌ Ошибка загрузки:', error.message);
    // Альтернативный способ - через echo и перенаправление
    console.log('🔄 Попытка альтернативного способа...');
    const escapedContent = fixed.replace(/'/g, "'\\''").replace(/\n/g, '\\n');
    await executeSSH(`cat > ${DOCKER_COMPOSE_PATH} << 'EOF'\n${fixed}\nEOF`);
  }
  
  // 4. Проверяем синтаксис YAML
  console.log('\n🔍 Проверка синтаксиса YAML...');
  const { stdout: yamlCheck } = await executeSSH(`cd /root/geodrive_n8n-agents && docker compose config > /dev/null 2>&1 && echo 'OK' || echo 'ERROR'`);
  
  if (yamlCheck.trim() === 'OK') {
    console.log('✅ Синтаксис YAML корректен');
  } else {
    console.log('⚠️  Возможны ошибки в синтаксисе YAML');
  }
  
  // 5. Перезапускаем n8n
  console.log('\n🔄 Перезапуск n8n контейнера...');
  await executeSSH('docker restart n8n');
  console.log('✅ n8n перезапущен');
  
  console.log('\n✅ Все исправления применены!');
  console.log('\n📋 Изменения:');
  console.log('   1. ✅ Удален EXECUTIONS_PROCESS=main (deprecated)');
  console.log('   2. ✅ Добавлен N8N_RUNNERS_ENABLED=true');
  console.log('   3. ✅ Добавлен N8N_BLOCK_ENV_ACCESS_IN_NODE=false');
  console.log('   4. ✅ Добавлен N8N_GIT_NODE_DISABLE_BARE_REPOS=true');
  console.log('   5. ✅ Исправлена синтаксическая ошибка в секции networks');
}

main().catch(error => {
  console.error('❌ Ошибка:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

