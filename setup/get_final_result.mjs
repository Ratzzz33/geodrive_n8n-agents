/**
 * Получить финальный результат синхронизации
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getFinalResult() {
  try {
    // Пробуем получить результат через API
    const { stdout: apiResult } = await execAsync(
      'python setup/server_ssh.py "curl -s http://localhost:3000/sync-bookings -X POST -H \'Content-Type: application/json\' --max-time 5 2>&1"'
    );
    
    if (apiResult && apiResult.includes('"success"')) {
      try {
        const result = JSON.parse(apiResult);
        console.log('✅ РЕЗУЛЬТАТ СИНХРОНИЗАЦИИ:\n');
        console.log('='.repeat(70));
        console.log(`Всего обработано: ${result.summary.total_bookings} бронирований`);
        console.log(`Создано: ${result.summary.total_created}`);
        console.log(`Обновлено: ${result.summary.total_updated}`);
        console.log(`Ошибок: ${result.summary.total_errors}`);
        console.log('\nПо филиалам:');
        result.per_branch.forEach(branch => {
          console.log(`  ${branch.branch}: ${branch.total} (создано: ${branch.created}, обновлено: ${branch.updated}, ошибок: ${branch.errors})`);
        });
        return;
      } catch (e) {
        // Не JSON, продолжаем
      }
    }
    
    // Если API не вернул результат, ищем в логах
    const { stdout: logs } = await execAsync(
      'python setup/server_ssh.py "tail -10000 /root/.pm2/logs/jarvis-api-out.log | grep \'Sync Bookings\' | tail -20"'
    );
    
    console.log('Поиск результата в логах...\n');
    console.log('Последние записи о синхронизации:');
    console.log(logs);
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

getFinalResult();

