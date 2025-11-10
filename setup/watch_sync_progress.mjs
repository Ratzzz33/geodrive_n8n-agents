/**
 * Отслеживание прогресса синхронизации в реальном времени
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getLatestLogs() {
  const { stdout } = await execAsync(
    'python setup/server_ssh.py "tail -500 /root/.pm2/logs/jarvis-api-out.log"'
  );
  return stdout;
}

async function watchProgress() {
  console.log('📊 Мониторинг прогресса синхронизации...\n');
  console.log('Нажмите Ctrl+C для остановки\n');
  console.log('='.repeat(70));
  
  const branchStats = {};
  let lastUpdate = Date.now();
  
  for (let i = 0; i < 120; i++) { // До 10 минут
    const logs = await getLatestLogs();
    const lines = logs.split('\n');
    
    // Ищем логи пагинации
    lines.forEach(line => {
      // Формат: [Paginate /all_bookings] tbilisi: Страница 50 - получено 10 записей, всего 500
      const match = line.match(/\[Paginate.*all_bookings\]\s+(\w+):\s+Страница\s+(\d+).*всего\s+(\d+)/);
      if (match) {
        const [, branch, page, total] = match;
        branchStats[branch] = {
          page: parseInt(page),
          total: parseInt(total),
          lastSeen: Date.now()
        };
        lastUpdate = Date.now();
      }
      
      // Завершение филиала
      const fetchedMatch = line.match(/\[Sync Bookings\]\s+(\w+):\s+Fetched\s+(\d+)\s+bookings/);
      if (fetchedMatch) {
        const [, branch, total] = fetchedMatch;
        branchStats[branch] = {
          ...branchStats[branch],
          completed: true,
          total: parseInt(total)
        };
      }
      
      // Общее завершение
      if (line.includes('Sync Bookings] Completed')) {
        const totalMatch = line.match(/Total bookings:\s+(\d+)/);
        const createdMatch = line.match(/Created:\s+(\d+)/);
        const updatedMatch = line.match(/Updated:\s+(\d+)/);
        const errorsMatch = line.match(/Errors:\s+(\d+)/);
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!');
        console.log('='.repeat(70));
        if (totalMatch) console.log(`   Всего обработано: ${totalMatch[1]} бронирований`);
        if (createdMatch) console.log(`   Создано: ${createdMatch[1]}`);
        if (updatedMatch) console.log(`   Обновлено: ${updatedMatch[1]}`);
        if (errorsMatch) console.log(`   Ошибок: ${errorsMatch[1]}`);
        return true;
      }
    });
    
    // Показываем текущий прогресс
    const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    const activeBranches = branches.filter(b => branchStats[b] && !branchStats[b].completed);
    
    if (activeBranches.length > 0 || Object.keys(branchStats).length > 0) {
      console.log(`\n[${new Date().toLocaleTimeString('ru-RU')}] Текущий прогресс:`);
      
      branches.forEach(branch => {
        const stats = branchStats[branch];
        if (stats) {
          if (stats.completed) {
            console.log(`   ✅ ${branch.toUpperCase()}: Завершено - ${stats.total} бронирований`);
          } else {
            const age = Math.floor((Date.now() - stats.lastSeen) / 1000);
            console.log(`   🔄 ${branch.toUpperCase()}: Страница ${stats.page}, всего ${stats.total} бронирований (${age}с назад)`);
          }
        } else {
          console.log(`   ⏳ ${branch.toUpperCase()}: Ожидание...`);
        }
      });
      
      const total = Object.values(branchStats).reduce((sum, s) => sum + (s.total || 0), 0);
      const maxPage = Math.max(...Object.values(branchStats).map(s => s.page || 0), 0);
      console.log(`   📊 Всего загружено: ${total} бронирований, макс. страница: ${maxPage}`);
    }
    
    // Если нет обновлений 2 минуты, возможно завершилось
    if (Date.now() - lastUpdate > 120000 && Object.keys(branchStats).length > 0) {
      console.log('\n⚠️  Нет обновлений 2 минуты, возможно синхронизация завершилась');
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // Проверяем каждые 10 секунд
  }
  
  console.log('\n📝 Для проверки финального результата запустите:');
  console.log('   python setup/server_ssh.py "pm2 logs jarvis-api --lines 50 | grep Sync"');
}

watchProgress().catch(console.error);

