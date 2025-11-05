import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkMultipleTimes() {
  console.log('Проверка прогресса каждые 30 секунд...\n');
  
  for (let i = 0; i < 5; i++) {
    if (i > 0) {
      console.log(`\nОжидание 30 секунд...\n`);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    console.log(`=== Проверка ${i + 1}/5 ===`);
    
    try {
      const { stdout } = await execAsync('node setup/check_processing_progress.mjs', {
        cwd: 'C:\\Users\\33pok\\geodrive_n8n-agents'
      });
      console.log(stdout);
    } catch (error) {
      console.error('Ошибка:', error.message);
    }
  }
}

checkMultipleTimes();

