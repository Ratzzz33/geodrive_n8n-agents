/**
 * Показать текущий прогресс синхронизации
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function showProgress() {
  try {
    // Получаем логи
    const { stdout } = await execAsync(
      'python setup/server_ssh.py "tail -500 /root/.pm2/logs/jarvis-api-out.log"'
    );
    
    const lines = stdout.split('\n');
    
    console.log('📊 ТЕКУЩИЙ ПРОГРЕСС СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ\n');
    console.log('='.repeat(70));
    
    const branchStats = {};
    let completed = null;
    
    // Парсим логи
    lines.forEach(line => {
      // Ищем строки вида: [Paginate /all_bookings] tbilisi: Страница 50 - получено 10 записей, всего 500
      // Или с кириллицей в другом формате
      if (line.includes('Paginate') && line.includes('all_bookings')) {
        // Ищем филиал
        let branch = null;
        if (line.includes('tbilisi')) branch = 'tbilisi';
        else if (line.includes('batumi')) branch = 'batumi';
        else if (line.includes('kutaisi')) branch = 'kutaisi';
        else if (line.includes('service-center')) branch = 'service-center';
        
        if (branch) {
          // Ищем числа в строке - последнее большое число обычно "всего"
          const numbers = line.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            // Предпоследнее - страница, последнее - всего
            const page = parseInt(numbers[numbers.length - 2]);
            const total = parseInt(numbers[numbers.length - 1]);
            
            if (page > 0 && total > 0 && total >= page * 10) {
              branchStats[branch] = {
                page: page,
                total: total
              };
            }
          }
        }
      }
      
      // Ищем завершение филиала
      if (line.includes('Sync Bookings') && line.includes('Fetched')) {
        const branchMatch = line.match(/(tbilisi|batumi|kutaisi|service-center)/);
        const totalMatch = line.match(/Fetched\s+(\d+)\s+bookings/);
        
        if (branchMatch && totalMatch) {
          branchStats[branchMatch[1]] = {
            ...branchStats[branchMatch[1]],
            completed: true,
            total: parseInt(totalMatch[1])
          };
        }
      }
      
      // Ищем общее завершение
      if (line.includes('Sync Bookings') && line.includes('Completed')) {
        const totalMatch = line.match(/Total bookings:\s+(\d+)/);
        const createdMatch = line.match(/Created:\s+(\d+)/);
        const updatedMatch = line.match(/Updated:\s+(\d+)/);
        const errorsMatch = line.match(/Errors:\s+(\d+)/);
        
        if (totalMatch) {
          completed = {
            total: parseInt(totalMatch[1]),
            created: createdMatch ? parseInt(createdMatch[1]) : 0,
            updated: updatedMatch ? parseInt(updatedMatch[1]) : 0,
            errors: errorsMatch ? parseInt(errorsMatch[1]) : 0
          };
        }
      }
    });
    
    // Показываем результаты
    const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    
    console.log('По филиалам:\n');
    branches.forEach(branch => {
      const stats = branchStats[branch];
      if (stats) {
        if (stats.completed) {
          console.log(`   ✅ ${branch.toUpperCase().padEnd(15)}: Завершено - ${stats.total} бронирований`);
        } else {
          console.log(`   🔄 ${branch.toUpperCase().padEnd(15)}: Страница ${String(stats.page).padStart(3)}, всего ${String(stats.total).padStart(5)} бронирований`);
        }
      } else {
        console.log(`   ⏳ ${branch.toUpperCase().padEnd(15)}: Ожидание или еще не начато`);
      }
    });
    
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
      const activeCount = Object.values(branchStats).filter(s => !s.completed).length;
      
      console.log('\n' + '='.repeat(70));
      console.log('📊 СВОДКА:');
      console.log(`   Всего загружено: ${total} бронирований`);
      console.log(`   Максимальная страница: ${maxPage}`);
      console.log(`   Активных филиалов: ${activeCount}`);
      console.log(`\n   💡 Синхронизация выполняется в фоне...`);
      console.log(`   💡 Запустите снова для обновления прогресса`);
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

showProgress();

