#!/usr/bin/env node

import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    
    https.get({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('🔍 Получаю workflow...\n');
    
    const response = await request('GET', `/workflows/${WORKFLOW_ID}`);
    const workflow = response.data || response;
    
    // Находим ноду "Save to DB"
    const saveNode = workflow.nodes.find(n => n.name === 'Save to DB');
    
    if (!saveNode) {
      console.error('❌ Нода "Save to DB" не найдена!');
      return;
    }
    
    console.log('✅ Нода "Save to DB" найдена');
    console.log('📝 Тип:', saveNode.type);
    console.log('📝 Версия:', saveNode.typeVersion);
    console.log('\n📄 Первые 1000 символов кода:\n');
    
    if (saveNode.parameters && saveNode.parameters.jsCode) {
      const code = saveNode.parameters.jsCode;
      console.log(code.substring(0, 1000));
      console.log('\n...\n');
      
      // Проверяем использование require
      if (code.includes('require(')) {
        console.log('⚠️ В коде используется require()!');
        console.log('   n8n Code ноды не поддерживают require()');
        console.log('   Нужно использовать встроенные модули или другой подход');
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

