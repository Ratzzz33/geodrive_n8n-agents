/**
 * Простой мониторинг прогресса синхронизации
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getLogs() {
  try {
    const { stdout } = await execAsync(
      'python setup/server_ssh.py "tail -500 /root/.pm2/logs/jarvis-api-out.log"'
    );
    return stdout;
  } catch (error) {
    return '';
  }
}

function parseLogLine(line) {
  // [Paginate /all_bookings] tbilisi: Страница 50 - получено 10 записей, всего 500
  const paginateMatch = line.match(/\[Paginate.*all_bookings\]\s+(\w+):\s+Страница\s+(\d+).*всего\s+(\d+)/);
  if (paginateMatch) {
    return {
      type: 'paginate',
      branch: paginateMatch[1],
      page: parseInt(paginateMatch[2]),
      total: parseInt(paginateMatch[3])
    };
  }
  
  // [Sync Bookings] tbilisi: Fetched 500 bookings from RentProg
  const fetchedMatch = line.match(/\[Sync Bookings\]\s+(\w+):\s+Fetched\s+(\d+)\s+bookings/);
  if (fetchedMatch) {
    return {
      type: 'fetched',
      branch: fetchedMatch[1],
      total: parseInt(fetchedMatch[2])
    };
  }
  
  // [Sync Bookings] Completed: Total bookings: 2000, Created: 100, Updated: 1900, Errors: 0
  const completedMatch = line.match(/\[Sync Bookings\]\s+Completed:.*Total bookings:\s+(\d+).*Created:\s+(\d+).*Updated:\s+(\d+).*Errors:\s+(\d+)/);
  if (completedMatch) {
    return {
      type: 'completed',
      total: parseInt(completedMatch[1]),
      created: parseInt(completedMatch[2]),
      updated: parseInt(completedMatch[3]),
      errors: parseInt(completedMatch[4])
    };
  }
  
  return null;
}

async function showProgress() {
  console.clear();
  console.log('📊 МОНИТОРИНГ СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ');
  console.log('='.repeat(70));
  console.log(`Время: ${new Date().toLocaleTimeString('ru-RU')}\n`);
  
  const logs = await getLogs();
  const lines = logs.split('\n');
  
  const branchStats = {};
  let completed = null;
  
  // Парсим все строки
  lines.forEach(line => {
    const parsed = parseLogLine(line);
    if (!parsed) return;
    
    if (parsed.type === 'paginate') {
      branchStats[parsed.branch] = {
        page: parsed.page,
        total: parsed.total,
        status: 'loading'
      };
    } else if (parsed.type === 'fetched') {
      branchStats[parsed.branch] = {
        total: parsed.total,
        status: 'completed'
      };
    } else if (parsed.type === 'completed') {
      completed = parsed;
    }
  });
  
  // Показываем прогресс по филиалам
  const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  
  branches.forEach(branch => {
    const stats = branchStats[branch];
    if (stats) {
      if (stats.status === 'completed') {
        console.log(`✅ ${branch.toUpperCase().padEnd(15)}: Завершено - ${stats.total} бронирований`);
      } else {
        console.log(`🔄 ${branch.toUpperCase().padEnd(15)}: Страница ${String(stats.page).padStart(3)}, всего ${String(stats.total).padStart(5)} бронирований`);
      }
    } else {
      console.log(`⏳ ${branch.toUpperCase().padEnd(15)}: Ожидание...`);
    }
  });
  
  // Итоговая статистика
  if (completed) {
    console.log('\n' + '='.repeat(70));
    console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!');
    console.log('='.repeat(70));
    console.log(`   Всего обработано: ${completed.total} бронирований`);
    console.log(`   Создано: ${completed.created}`);
    console.log(`   Обновлено: ${completed.updated}`);
    console.log(`   Ошибок: ${completed.errors}`);
  } else {
    const total = Object.values(branchStats).reduce((sum, s) => sum + (s.total || 0), 0);
    const maxPage = Math.max(...Object.values(branchStats).map(s => s.page || 0), 0);
    const activeBranches = Object.values(branchStats).filter(s => s.status === 'loading').length;
    
    console.log('\n' + '='.repeat(70));
    console.log(`📊 ТЕКУЩИЙ ПРОГРЕСС:`);
    console.log(`   Всего загружено: ${total} бронирований`);
    console.log(`   Максимальная страница: ${maxPage}`);
    console.log(`   Активных филиалов: ${activeBranches}`);
    console.log(`\n   Обновление каждые 5 секунд...`);
  }
}

// Запускаем мониторинг
console.log('Запуск мониторинга...\n');

const interval = setInterval(async () => {
  await showProgress();
}, 5000);

// Показываем сразу
showProgress().catch(console.error);

// Останавливаем через 30 минут
setTimeout(() => {
  clearInterval(interval);
  console.log('\n\n⏱️  Мониторинг остановлен (30 минут)');
  process.exit(0);
}, 30 * 60 * 1000);

