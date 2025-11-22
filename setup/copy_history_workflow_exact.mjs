#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('📋 Копирую workflow истории операций и адаптирую для автомобилей...\n');

try {
  // Получаем исходный workflow
  const sourceId = 'xSjwtwrrWUGcBduU';
  console.log(`📥 Загружаю исходный workflow ${sourceId}...`);
  
  const response = await fetch(`${N8N_HOST}/workflows/${sourceId}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  
  const source = await response.json();
  console.log(`   ✅ Загружено ${source.nodes.length} нод`);
  
  // Создаем копию
  const workflow = JSON.parse(JSON.stringify(source));
  
  // Удаляем системные поля
  delete workflow.id;
  delete workflow.versionId;
  delete workflow.createdAt;
  delete workflow.updatedAt;
  
  // Меняем имя
  workflow.name = '✅ Парсинг HTML страницы автомобилей раз в час';
  
  // Меняем Schedule Trigger на 1 час
  const scheduleNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.scheduleTrigger');
  if (scheduleNode) {
    console.log('\n🔨 Изменяю Schedule Trigger: 3 минуты → 1 час');
    scheduleNode.parameters.rule.interval[0] = { field: 'hours', hoursInterval: 1 };
  }
  
  // Находим HTTP Request ноды и меняем URL/body для парсинга cars
  const httpNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
  console.log(`\n🔨 Найдено ${httpNodes.length} HTTP Request нод`);
  
  for (const node of httpNodes) {
    console.log(`   Обновляю: ${node.name}`);
    
    // Меняем URL на /cars
    if (node.parameters.url) {
      node.parameters.url = node.parameters.url.replace('/history', '/cars');
    }
    
    // Меняем body для парсинга cars (если есть и это строка без expressions)
    if (node.parameters.jsonBody && typeof node.parameters.jsonBody === 'string' && !node.parameters.jsonBody.includes('={{')) {
      try {
        const body = JSON.parse(node.parameters.jsonBody);
        if (body.model) {
          body.model = 'car';
          node.parameters.jsonBody = JSON.stringify(body);
        }
      } catch (e) {
        // Пропускаем, если это n8n expression
      }
    }
  }
  
  // Меняем "Save to History" на "Save to Cars"
  const saveNode = workflow.nodes.find(n => n.name === 'Save to History');
  if (saveNode) {
    console.log('\n🔨 Изменяю "Save to History" → работа с таблицей cars');
    saveNode.name = 'Save to Cars';
    
    // Меняем SQL запрос
    saveNode.parameters.query = `INSERT INTO cars (
  branch, rentprog_id, car_name, code, number, color, year, price, deposit, is_active, data
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10::jsonb
)
ON CONFLICT (branch, rentprog_id) 
DO UPDATE SET
  car_name = EXCLUDED.car_name,
  code = EXCLUDED.code,
  number = EXCLUDED.number,
  color = EXCLUDED.color,
  year = EXCLUDED.year,
  price = EXCLUDED.price,
  deposit = EXCLUDED.deposit,
  is_active = EXCLUDED.is_active,
  data = EXCLUDED.data,
  updated_at = NOW()
RETURNING id;`;
  }
  
  // Обновляем connections если имя ноды изменилось
  if (workflow.connections['Save to History']) {
    workflow.connections['Save to Cars'] = workflow.connections['Save to History'];
    delete workflow.connections['Save to History'];
  }
  
  // Обновляем все connections которые ссылаются на "Save to History"
  for (const [nodeName, nodeConnections] of Object.entries(workflow.connections)) {
    if (nodeConnections.main) {
      for (const outputs of nodeConnections.main) {
        if (outputs) {
          for (const connection of outputs) {
            if (connection.node === 'Save to History') {
              connection.node = 'Save to Cars';
            }
          }
        }
      }
    }
  }
  
  // Обновляем "Merge & Process" для обработки данных автомобилей
  const mergeNode = workflow.nodes.find(n => n.name === 'Merge & Process');
  if (mergeNode) {
    console.log('\n🔨 Обновляю "Merge & Process" для парсинга автомобилей');
    
    // Здесь будет код обработки HTML таблицы автомобилей
    mergeNode.parameters.jsCode = `const results = [];

for (const item of $input.all()) {
  const branch = item.json.branch;
  const html = item.json.data || item.json.body || '';
  
  if (!html || html.length < 100) {
    results.push({
      json: {
        branch: branch,
        error: true,
        error_message: 'HTML not loaded'
      }
    });
    continue;
  }
  
  // Парсим HTML таблицу
  const rowRegex = /<tr[^>]*>(.*?)<\\/tr>/gs;
  const cellRegex = /<td[^>]*>(.*?)<\\/td>/gs;
  
  const rows = [...html.matchAll(rowRegex)];
  
  for (const rowMatch of rows) {
    const rowHTML = rowMatch[1];
    const cells = [...rowHTML.matchAll(cellRegex)].map(m => 
      m[1].replace(/<[^>]*>/g, '').trim()
    );
    
    if (cells.length < 15 || !cells[0]) continue;
    
    const id = cells[0];
    if (!id || isNaN(id)) continue;
    
    const carData = {
      id: parseInt(id),
      name: cells[1] || '',
      code: cells[2] || '',
      number: cells[4] || '',
      color: cells[5] || '',
      year: cells[6] ? parseInt(cells[6]) : null,
      price: cells[7] !== '?' ? parseInt(cells[7]) || 0 : null,
      deposit: cells[14] ? parseInt(cells[14]) || 0 : 0
    };
    
    results.push({
      json: {
        branch: branch,
        rentprog_id: carData.id,
        car_name: carData.name,
        code: carData.code,
        number: carData.number,
        color: carData.color,
        year: carData.year,
        price: carData.price,
        deposit: carData.deposit,
        data: carData,
        error: false
      }
    });
  }
}

return results;`;
  }
  
  console.log('\n🗑️  Удаляю старые workflows автомобилей...');
  for (const oldId of ['2AVgANINr86efOZh', 'NcAxHFLxpo2ben1s', 't7zMiBmlhdfEEgBV']) {
    try {
      await fetch(`${N8N_HOST}/workflows/${oldId}`, {
        method: 'DELETE',
        headers: { 'X-N8N-API-KEY': N8N_API_KEY }
      });
      console.log(`   ✅ ${oldId}`);
    } catch (e) {}
  }
  
  // Сохраняем в файл для импорта через правильный скрипт
  console.log('\n💾 Сохраняю workflow в файл...');
  const fs = await import('fs');
  const path = await import('path');
  
  const workflowPath = path.join('n8n-workflows', 'cars-parser-from-template.json');
  fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
  console.log(`   ✅ Сохранено: ${workflowPath}`);
  
  console.log('\n📤 Импортирую через скрипт 2025...');
  const { execSync } = await import('child_process');
  
  try {
    const output = execSync(`node setup/import_workflow_2025.mjs ${workflowPath}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(output);
  } catch (e) {
    throw new Error(`Import failed: ${e.stdout || e.message}`);
  }
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

