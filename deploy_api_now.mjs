// Быстрый деплой API через SSH
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const commands = [
  'cd /root/geodrive_n8n-agents && git pull',
  'cd /root/geodrive_n8n-agents && npm run build',
  'pm2 restart jarvis-api',
  'sleep 3',
  'pm2 status jarvis-api',
  'curl -X POST http://localhost:3000/starline/update-gps -H "Content-Type: application/json" --max-time 30'
];

async function run() {
  console.log('🚀 Начинаю деплой API...\n');
  
  for (const cmd of commands) {
    console.log(`📝 Выполняю: ${cmd}`);
    try {
      const { stdout, stderr } = await execAsync(
        `python setup/server_ssh.py "${cmd.replace(/"/g, '\\"')}"`
      );
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (error) {
      console.error(`❌ Ошибка: ${error.message}`);
    }
    console.log('');
  }
  
  console.log('✅ Деплой завершен!');
}

run().catch(console.error);


