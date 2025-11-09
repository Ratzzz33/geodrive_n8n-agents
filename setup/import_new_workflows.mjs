#!/usr/bin/env node

/**
 * Импорт новых workflows в n8n
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const workflows = [
  {
    name: 'RentProg Monitor - Cash & Events',
    file: 'rentprog-monitor-cash-events.json'
  },
  {
    name: 'RentProg Daily - Employee Cash Reconciliation',
    file: 'rentprog-daily-employee-cash.json'
  }
];

async function importWorkflow(workflowFile) {
  const filePath = join(projectRoot, 'n8n-workflows', workflowFile);
  const content = readFileSync(filePath, 'utf8');
  const workflow = JSON.parse(content);
  
  console.log(`\n📤 Импорт: "${workflow.name}"...`);
  
  try {
    const response = await fetch(`${N8N_API_URL}/workflows`, {
      method: 'POST',
      headers,
      body: JSON.stringify(workflow)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const result = await response.json();
    const workflowId = result.data?.id || result.id;
    
    console.log(`   ✅ Успешно импортирован!`);
    console.log(`   🆔 ID: ${workflowId}`);
    console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
    
    return { success: true, id: workflowId, name: workflow.name };
    
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}`);
    return { success: false, error: error.message, name: workflow.name };
  }
}

async function main() {
  console.log('🚀 Импорт новых workflows в n8n...\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const wf of workflows) {
    const result = await importWorkflow(wf.file);
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 ИТОГО:');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`   ✅ Успешно: ${successful.length}`);
  if (successful.length > 0) {
    successful.forEach(r => {
      console.log(`      • ${r.name} (${r.id})`);
    });
  }
  
  console.log(`   ❌ Ошибок: ${failed.length}`);
  if (failed.length > 0) {
    failed.forEach(r => {
      console.log(`      • ${r.name}`);
    });
  }
  
  console.log('='.repeat(60) + '\n');
  
  if (failed.length > 0) {
    process.exit(1);
  }
  
  console.log('✅ Все workflows успешно импортированы!\n');
}

main().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});

