/**
 * Добавление переменных окружения для Umnico Telegram интеграции в .env файл
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');

const newVars = `
# Umnico Telegram интеграция
# ID Telegram чата (группы/форума) для создания тем диалогов с клиентами
UMNICO_FORUM_CHAT_ID=-5015844768
# Интервал polling активных чатов в секундах (по умолчанию 5)
UMNICO_POLLING_INTERVAL=5
# URL веб-приложения для просмотра истории переписки
WEB_APP_URL=https://conversations.rentflow.rentals
# URL Playwright Service для взаимодействия с Umnico UI
PLAYWRIGHT_UMNICO_URL=http://localhost:3001
`;

async function addEnvVars() {
  try {
    let envContent = '';
    
    // Читаем существующий .env файл если он есть
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      // Проверяем, есть ли уже эти переменные
      if (envContent.includes('UMNICO_FORUM_CHAT_ID')) {
        console.log('⚠️  Переменные Umnico уже присутствуют в .env файле');
        console.log('   Пропускаю добавление...');
        return;
      }
      
      // Добавляем новые переменные в конец файла
      if (!envContent.endsWith('\n')) {
        envContent += '\n';
      }
    }
    
    // Добавляем новые переменные
    envContent += newVars;
    
    // Записываем обратно
    fs.writeFileSync(envPath, envContent, 'utf8');
    
    console.log('✅ Переменные окружения добавлены в .env файл:');
    console.log('   - UMNICO_FORUM_CHAT_ID=-5015844768');
    console.log('   - UMNICO_POLLING_INTERVAL=5');
    console.log('   - WEB_APP_URL=https://conversations.rentflow.rentals');
    console.log('   - PLAYWRIGHT_UMNICO_URL=http://localhost:3001');
    
  } catch (error) {
    console.error('❌ Ошибка при добавлении переменных:', error.message);
    process.exit(1);
  }
}

addEnvVars();

