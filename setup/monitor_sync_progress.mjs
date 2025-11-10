/**
 * Мониторинг прогресса синхронизации бронирований в реальном времени
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getLogs() {
  try {
    const { stdout } = await execAsync(
      'python setup/server_ssh.py "pm2 logs jarvis-api --lines 200 --nostream 2>&1"'
    );
    return stdout;
  } catch (error) {
    return error.stdout || '';
  }
}

async function monitorProgress() {
  console.log('📊 Мониторинг прогресса синхронизации бронирований...\n');
  console.log('='.repeat(70));
  
  let lastPage = 0;
  let lastTotal = 0;
  let branchStats = {};
  
  for (let i = 0; i < 60; i++) { // Мониторим до 60 итераций (примерно 5-10 минут)
    const logs = await getLogs();
    
    // Ищем логи пагинации
    const paginateMatches = logs.match(/\[Paginate.*all_bookings\].*Страница (\d+).*получено (\d+) записей, всего (\d+)/g);
    if (paginateMatches) {
      paginateMatches.forEach(match => {
        const pageMatch = match.match(/Страница (\d+)/);
        const totalMatch = match.match(/всего (\d+)/);
        if (pageMatch && totalMatch) {
          const page = parseInt(pageMatch[1]);
          const total = parseInt(totalMatch[1]);
          if (page > lastPage || total > lastTotal) {
            lastPage = Math.max(lastPage, page);
            lastTotal = Math.max(lastTotal, total);
            console.log(`📄 Страница ${page}: всего загружено ${total} бронирований`);
          }
        }
      });
    }
    
    // Ищем логи синхронизации по филиалам
    const branchMatches = logs.match(/\[Sync Bookings\] (tbilisi|batumi|kutaisi|service-center):.*(\d+) бронирований/g);
    if (branchMatches) {
      branchMatches.forEach(match => {
        const branchMatch = match.match(/(tbilisi|batumi|kutaisi|service-center)/);
        const countMatch = match.match(/(\d+) бронирований/);
        if (branchMatch && countMatch) {
          branchStats[branchMatch[1]] = parseInt(countMatch[1]);
        }
      });
    }
    
    // Ищем завершение
    const completedMatch = logs.match(/\[Sync Bookings\] Completed:.*Total bookings: (\d+)/);
    if (completedMatch) {
      const total = parseInt(completedMatch[1]);
      console.log(`\n✅ Синхронизация завершена! Всего обработано: ${total} бронирований`);
      break;
    }
    
    // Показываем текущий прогресс
    if (lastTotal > 0) {
      const branches = Object.keys(branchStats);
      if (branches.length > 0) {
        console.log(`\n📊 Текущий прогресс:`);
        console.log(`   Страниц обработано: ${lastPage}`);
        console.log(`   Всего загружено: ${lastTotal} бронирований`);
        console.log(`   По филиалам:`);
        branches.forEach(branch => {
          console.log(`      ${branch}: ${branchStats[branch] || 0}`);
        });
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Проверяем каждые 5 секунд
  }
  
  // Финальная проверка
  const finalLogs = await getLogs();
  const finalMatch = finalLogs.match(/\[Sync Bookings\] Completed:.*Total bookings: (\d+),.*Created: (\d+),.*Updated: (\d+),.*Errors: (\d+)/);
  
  if (finalMatch) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:');
    console.log('='.repeat(70));
    console.log(`   Всего обработано: ${finalMatch[1]} бронирований`);
    console.log(`   Создано: ${finalMatch[2]}`);
    console.log(`   Обновлено: ${finalMatch[3]}`);
    console.log(`   Ошибок: ${finalMatch[4]}`);
  } else {
    console.log('\n⚠️  Синхронизация еще выполняется или завершилась с ошибкой');
    console.log('   Проверьте логи: python setup/server_ssh.py "pm2 logs jarvis-api --lines 100"');
  }
}

monitorProgress().catch(console.error);

