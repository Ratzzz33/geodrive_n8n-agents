// Тест официального n8n-mcp сервера
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Тест запуска официального n8n-mcp сервера...\n');

const env = {
  ...process.env,
  MCP_MODE: 'stdio',
  LOG_LEVEL: 'error',
  DISABLE_CONSOLE_OUTPUT: 'true',
  N8N_API_URL: 'https://n8n.rentflow.rentals/api/v1',
  N8N_API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI'
};

const npxPath = 'C:\\nvm4w\\nodejs\\npx.cmd';
const args = ['-y', 'n8n-mcp'];

console.log(`Команда: ${npxPath} ${args.join(' ')}`);
console.log(`Рабочая директория: ${__dirname}\n`);

const proc = spawn(npxPath, args, {
  env,
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

proc.stdout.on('data', (data) => {
  stdout += data.toString();
  console.log(`[STDOUT] ${data.toString()}`);
});

proc.stderr.on('data', (data) => {
  stderr += data.toString();
  console.error(`[STDERR] ${data.toString()}`);
});

proc.on('exit', (code) => {
  console.log(`\nПроцесс завершился с кодом: ${code}`);
  if (code !== 0) {
    console.error('\nОшибка запуска!');
    console.error(`STDERR: ${stderr}`);
    process.exit(1);
  }
});

proc.on('error', (error) => {
  console.error(`Ошибка: ${error.message}`);
  process.exit(1);
});

// Закрываем через 5 секунд
setTimeout(() => {
  console.log('\nЗавершаем тест...');
  proc.kill();
  process.exit(0);
}, 5000);

