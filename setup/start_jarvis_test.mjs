/**
 * Запуск Jarvis API для тестирования Umnico интеграции
 * Запускает только проверку что UmnicoRealtimeSync инициализируется
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Запуск Jarvis API для тестирования...\n');

// Запускаем npm start
const jarvis = spawn('npm', ['start'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

// Ждем 10 секунд для инициализации
setTimeout(() => {
  console.log('\n⏱️  Проверка логов (10 секунд)...');
  console.log('   Ищите в логах: "✅ Umnico Realtime Sync started"');
  console.log('\n💡 Для остановки нажмите Ctrl+C');
}, 10000);

jarvis.on('error', (error) => {
  console.error('❌ Ошибка запуска:', error.message);
  process.exit(1);
});

jarvis.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ Jarvis API завершился с кодом ${code}`);
  }
});

