#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const EXECUTION_ID = '24880';

// Отсутствующие операции
const missingIds = ['1864454', '1863796', '1863792'];

async function traceOperations() {
  try {
    console.log('🔍 Получаю execution #24880...\n');
    
    const response = await fetch(`https://n8n.rentflow.rentals/api/v1/executions/${EXECUTION_ID}?includeData=true`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const data = await response.json();
    
    if (!data.data || !data.data.resultData || !data.data.resultData.runData) {
      console.log('❌ Нет данных execution');
      return;
    }
    
    const runData = data.data.resultData.runData;
    const nodeNames = Object.keys(runData);
    
    console.log('📊 Execution Status:', data.status);
    console.log('⏱️ Started:', data.startedAt);
    console.log('⏱️ Stopped:', data.stoppedAt);
    console.log('\n📋 Ноды в execution:', nodeNames.length);
    console.log('');
    
    // Отслеживаем операции по каждой ноде
    console.log('🔎 Отслеживание операций #1864454, #1863796, #1863792:\n');
    console.log('═'.repeat(80));
    
    for (const nodeName of nodeNames) {
      const nodeData = runData[nodeName];
      if (!Array.isArray(nodeData) || nodeData.length === 0) continue;
      
      const run = nodeData[0];
      if (!run.data || !run.data.main || !run.data.main[0]) continue;
      
      const items = run.data.main[0];
      
      // Искать ID в разных полях
      const foundInNode = new Set();
      
      items.forEach(item => {
        if (!item.json) return;
        
        const json = item.json;
        
        // Проверяем различные поля где может быть ID
        const possibleIds = [
          json.id,
          json.rp_payment_id,
          json.payment_id,
          json.operation_id,
          json.rentprog_id
        ];
        
        // Проверяем raw_data если есть
        if (json.raw_data) {
          try {
            const raw = typeof json.raw_data === 'string' 
              ? JSON.parse(json.raw_data) 
              : json.raw_data;
            if (raw.id) possibleIds.push(String(raw.id));
          } catch (e) {}
        }
        
        // Проверяем массивы если есть
        if (Array.isArray(json.payments)) {
          json.payments.forEach(p => {
            if (p.id) possibleIds.push(String(p.id));
          });
        }
        
        // Ищем совпадения
        possibleIds.forEach(id => {
          if (id && missingIds.includes(String(id))) {
            foundInNode.add(String(id));
          }
        });
      });
      
      if (foundInNode.size > 0) {
        console.log(`\n✅ Нода: ${nodeName}`);
        console.log(`   Всего items: ${items.length}`);
        console.log(`   Найдено операций: ${Array.from(foundInNode).join(', ')}`);
        
        // Показать детали первого найденного
        const firstFound = Array.from(foundInNode)[0];
        const foundItem = items.find(item => {
          if (!item.json) return false;
          const json = item.json;
          const ids = [
            json.id,
            json.rp_payment_id,
            json.payment_id,
            json.operation_id,
            json.rentprog_id
          ];
          return ids.some(id => String(id) === firstFound);
        });
        
        if (foundItem && foundItem.json) {
          console.log(`   Пример данных (ID: ${firstFound}):`);
          const json = foundItem.json;
          Object.keys(json).slice(0, 10).forEach(key => {
            if (key !== 'raw_data' && key !== 'payments') {
              const value = typeof json[key] === 'object' 
                ? JSON.stringify(json[key]).substring(0, 50) 
                : String(json[key]).substring(0, 50);
              console.log(`     ${key}: ${value}`);
            }
          });
        }
      } else {
        console.log(`\n⚪ Нода: ${nodeName} (${items.length} items) - операции НЕ найдены`);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 ИТОГО ПО НОДАМ:\n');
    
    // Подсчет по всем нодам
    nodeNames.forEach(nodeName => {
      const nodeData = runData[nodeName];
      if (!Array.isArray(nodeData) || nodeData.length === 0) return;
      const run = nodeData[0];
      if (!run.data || !run.data.main || !run.data.main[0]) return;
      console.log(`  ${nodeName}: ${run.data.main[0].length} items`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

traceOperations();

