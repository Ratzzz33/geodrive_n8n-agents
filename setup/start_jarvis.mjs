/**
 * Запуск Jarvis API в фоновом режиме
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 Запуск Jarvis API...\n');

// Проверяем что API не запущен
try {
  const response = await fetch('http://localhost:3000/health', {
    signal: AbortSignal.timeout(2000)
  });
  
  if (response.ok) {
    console.log('✅ Jarvis API уже запущен');
    process.exit(0);
  }
} catch {
  // API не запущен, продолжаем
}

// Запускаем npm start
const child = spawn('npm', ['start'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  detached: true
});

child.unref();

console.log('✅ Jarvis API запускается...');
console.log('💡 Подождите 10-15 секунд для инициализации');
console.log('💡 Проверьте статус: node setup/check_system_status.mjs');

// Даем время на запуск
setTimeout(() => {
  console.log('\n⏳ Проверка статуса...');
  
  fetch('http://localhost:3000/health', {
    signal: AbortSignal.timeout(5000)
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Jarvis API запущен и отвечает!');
      process.exit(0);
    })
    .catch(() => {
      console.log('⚠️  API еще не отвечает, подождите еще немного');
      console.log('💡 Проверьте логи или запустите вручную: npm start');
      process.exit(1);
    });
}, 15000);

