#!/usr/bin/env node
/**
 * Проверка ноды "Save to DB" в workflow
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function checkWorkflow() {
  console.log(`\n🔍 Проверка workflow...\n`);
  
  // Получаем workflow
  const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow: ${getResponse.statusText}`);
  }
  
  const current = await getResponse.json();
  console.log(`✅ Workflow: ${current.name}\n`);
  
  // Находим ноду Save to DB
  const saveNode = current.nodes.find(n => n.name === 'Save to DB');
  
  if (!saveNode) {
    console.log('❌ Нода "Save to DB" не найдена!');
    return;
  }
  
  console.log('📋 Нода "Save to DB":');
  console.log(`   Тип: ${saveNode.type}`);
  console.log(`   Версия: ${saveNode.typeVersion}`);
  console.log('\n📝 Параметры:');
  console.log(JSON.stringify(saveNode.parameters, null, 2));
  
  // Проверяем connections к этой ноде
  console.log('\n🔗 Connections К "Save to DB":');
  
  Object.entries(current.connections).forEach(([nodeName, conns]) => {
    if (conns.main && conns.main[0]) {
      conns.main[0].forEach(conn => {
        if (conn.node === 'Save to DB') {
          console.log(`   ← ${nodeName}`);
        }
      });
    }
  });
  
  // Проверяем connections ОТ этой ноды
  console.log('\n🔗 Connections ОТ "Save to DB":');
  
  if (current.connections['Save to DB']) {
    const conns = current.connections['Save to DB'];
    if (conns.main && conns.main[0]) {
      conns.main[0].forEach(conn => {
        console.log(`   → ${conn.node}`);
      });
    }
  } else {
    console.log('   ❌ НЕТ исходящих connections!');
  }
  
  console.log('\n');
}

checkWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

