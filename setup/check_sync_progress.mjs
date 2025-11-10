/**
 * Быстрая проверка прогресса синхронизации
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkProgress() {
  try {
    const { stdout } = await execAsync(
      'python setup/server_ssh.py "tail -200 /root/.pm2/logs/jarvis-api-out.log | grep -E \'(Paginate.*all_bookings|Sync Bookings.*Completed|Sync Bookings.*Fetched)\' | tail -20"'
    );
    
    const lines = stdout.split('\n').filter(l => l.trim());
    
    console.log('📊 ПРОГРЕСС СИНХРОНИЗАЦИИ БРОНИРОВАНИЙ\n');
    console.log('='.repeat(70));
    
    const branchProgress = {};
    let completed = false;
    let totalProcessed = 0;
    
    lines.forEach(line => {
      // Страницы пагинации
      const pageMatch = line.match(/\[Paginate.*all_bookings\]\s+(\w+):\s+Страница\s+(\d+).*получено\s+(\d+).*всего\s+(\d+)/);
      if (pageMatch) {
        const [, branch, page, onPage, total] = pageMatch;
        branchProgress[branch] = {
          page: parseInt(page),
          total: parseInt(total),
          onPage: parseInt(onPage)
        };
      }
      
      // Завершение по филиалу
      const fetchedMatch = line.match(/\[Sync Bookings\]\s+(\w+):\s+Fetched\s+(\d+)\s+bookings/);
      if (fetchedMatch) {
        const [, branch, total] = fetchedMatch;
        branchProgress[branch] = {
          ...branchProgress[branch],
          completed: true,
          total: parseInt(total)
        };
      }
      
      // Общее завершение
      if (line.includes('Sync Bookings] Completed')) {
        completed = true;
        const totalMatch = line.match(/Total bookings:\s+(\d+)/);
        if (totalMatch) {
          totalProcessed = parseInt(totalMatch[1]);
        }
      }
    });
    
    if (Object.keys(branchProgress).length === 0) {
      console.log('⏳ Синхронизация еще не началась или логи не найдены');
      return;
    }
    
    const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    
    branches.forEach(branch => {
      const progress = branchProgress[branch];
      if (progress) {
        if (progress.completed) {
          console.log(`✅ ${branch.toUpperCase()}: Завершено - ${progress.total} бронирований`);
        } else {
          console.log(`🔄 ${branch.toUpperCase()}: Страница ${progress.page}, всего ${progress.total} бронирований`);
        }
      } else {
        console.log(`⏳ ${branch.toUpperCase()}: Ожидание...`);
      }
    });
    
    if (completed) {
      console.log(`\n✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!`);
      console.log(`   Всего обработано: ${totalProcessed} бронирований`);
    } else {
      const total = Object.values(branchProgress).reduce((sum, p) => sum + (p.total || 0), 0);
      const maxPage = Math.max(...Object.values(branchProgress).map(p => p.page || 0));
      console.log(`\n🔄 В ПРОЦЕССЕ...`);
      console.log(`   Всего загружено: ${total} бронирований`);
      console.log(`   Максимальная страница: ${maxPage}`);
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

checkProgress();

