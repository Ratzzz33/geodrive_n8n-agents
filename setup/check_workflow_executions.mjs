#!/usr/bin/env node
/**
 * Быстрая проверка последних executions для указанного workflow.
 * Делает запрос к n8n API и выводит статус + полезные поля.
 */

import https from 'https';

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const workflowId = process.argv[2] || 'P3BnmX7Nrmh1cusF';
const limit = Number(process.argv[3]) || 3;

function request(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        Accept: 'application/json',
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log(`🔍 Получаю последние ${limit} executions для workflow ${workflowId}`);
    const path = `/executions?workflowId=${workflowId}&limit=${limit}&includeData=true`;
    const response = await request(path);

    const executions = response.data || response.executions || [];
    console.log(`📊 Найдено: ${executions.length}`);

    executions.forEach((exec) => {
      const started = exec.startedAt ? new Date(exec.startedAt).toLocaleString('ru-RU') : 'n/a';
      const status = exec.status || exec.finished ? 'success' : exec.error ? 'error' : exec.mode;
      console.log(`\nID: ${exec.id}`);
      console.log(`Статус: ${status}`);
      console.log(`Начало: ${started}`);
      if (exec.finished) {
        console.log(`Завершён: ${new Date(exec.finished).toLocaleString('ru-RU')}`);
      }
      if (exec.error) {
        console.log(`Ошибка: ${exec.error.message || exec.error}`);
      }
      if (exec.data?.resultData?.runData?.['Save to DB']) {
        const nodeRuns = exec.data.resultData.runData['Save to DB'];
        const affected = nodeRuns[0]?.data?.main?.[0]?.[0]?.json?.affected ?? 'n/a';
        console.log(`Записей в БД: ${affected}`);
      }
    });
  } catch (error) {
    console.error('❌ Ошибка запроса:', error.message);
    process.exit(1);
  }
}

main();

