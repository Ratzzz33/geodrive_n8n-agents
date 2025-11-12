// Активация workflow и тестовый запрос
import https from 'https';

const WORKFLOW_ID = 'E908DpPMn8Z9JEyu';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

// 1. Активируем workflow
console.log('🔧 Активирую workflow...');
const activateData = JSON.stringify({});

const activateOptions = {
  hostname: 'n8n.rentflow.rentals',
  port: 443,
  path: `/api/v1/workflows/${WORKFLOW_ID}/activate`,
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(activateData)
  }
};

const activateReq = https.request(activateOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('✅ Workflow активирован');
    console.log('Ответ:', data);
    
    // 2. Делаем тестовый запрос
    setTimeout(() => {
      console.log('\n📤 Отправляю тестовый запрос...');
      const testData = JSON.stringify({
        deviceId: 123456,
        dateFrom: '2025-11-12',
        dateTo: '2025-11-12'
      });
      
      const testOptions = {
        hostname: 'webhook.rentflow.rentals',
        port: 443,
        path: '/webhook/starline-routes-html',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(testData)
        },
        timeout: 180000
      };
      
      const testReq = https.request(testOptions, (res) => {
        console.log(`\n📥 Статус: ${res.statusCode}`);
        let chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            const fs = require('fs');
            const fileName = 'starline-routes-test.html';
            fs.writeFileSync(fileName, Buffer.concat(chunks));
            console.log(`✅ HTML сохранен: ${fileName}`);
            console.log(`📊 Размер: ${fs.statSync(fileName).size} байт`);
          } else {
            console.log('❌ Ошибка:', Buffer.concat(chunks).toString());
          }
        });
      });
      
      testReq.on('error', (e) => console.error('❌ Ошибка:', e));
      testReq.write(testData);
      testReq.end();
    }, 2000);
  });
});

activateReq.on('error', (e) => console.error('❌ Ошибка активации:', e));
activateReq.write(activateData);
activateReq.end();

