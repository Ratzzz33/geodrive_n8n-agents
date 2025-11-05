#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SERVER_HOST = '46.224.17.15';
const SERVER_USER = 'root';
const SERVER_PASSWORD = 'Geodrive2024SecurePass';

async function addTelegramChatId() {
  console.log('🔧 Добавление TELEGRAM_ALERT_CHAT_ID на сервер\n');
  
  const commands = [
    // 1. Проверить текущее значение
    'echo "📋 Текущие Telegram переменные в docker-compose.yml:"',
    'grep -i telegram /root/geodrive_n8n-agents/docker-compose.yml || echo "Не найдено"',
    '',
    // 2. Добавить переменную в docker-compose.yml (если еще нет)
    'echo ""',
    'echo "➕ Добавление TELEGRAM_ALERT_CHAT_ID..."',
    `cd /root/geodrive_n8n-agents && grep -q "TELEGRAM_ALERT_CHAT_ID" docker-compose.yml || sed -i '/environment:/a\\      - TELEGRAM_ALERT_CHAT_ID=-5004140602' docker-compose.yml`,
    '',
    // 3. Показать результат
    'echo "✅ Обновлённые переменные:"',
    'grep -A 2 -i telegram /root/geodrive_n8n-agents/docker-compose.yml || echo "Не найдено"',
    '',
    // 4. Перезапустить n8n
    'echo ""',
    'echo "🔄 Перезапуск n8n контейнера..."',
    'cd /root/geodrive_n8n-agents && docker compose stop n8n && docker compose up -d n8n',
    '',
    // 5. Проверить переменную внутри контейнера
    'echo ""',
    'echo "⏳ Ожидание 5 секунд..."',
    'sleep 5',
    'echo "✅ Проверка внутри контейнера:"',
    'docker exec n8n printenv TELEGRAM_ALERT_CHAT_ID || echo "❌ Переменная не найдена"'
  ];
  
  const sshCommand = `sshpass -p '${SERVER_PASSWORD}' ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "${commands.join(' && ')}"`;
  
  try {
    const { stdout, stderr } = await execAsync(sshCommand);
    console.log(stdout);
    if (stderr) {
      console.error('⚠️ Stderr:', stderr);
    }
    
    console.log('\n✅ Готово! Переменная TELEGRAM_ALERT_CHAT_ID добавлена.');
    console.log('\n📝 Проверьте workflows - теперь Chat ID должен отображаться правильно.');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    
    // Fallback: показать инструкции для ручного выполнения
    console.log('\n📋 Выполните вручную на сервере:\n');
    console.log('ssh root@46.224.17.15');
    console.log('cd /root/geodrive_n8n-agents');
    console.log('nano docker-compose.yml');
    console.log('');
    console.log('# Добавьте в секцию environment для n8n:');
    console.log('      - TELEGRAM_ALERT_CHAT_ID=-5004140602');
    console.log('');
    console.log('# Затем перезапустите:');
    console.log('docker compose stop n8n && docker compose up -d n8n');
    
    process.exit(1);
  }
}

addTelegramChatId();

