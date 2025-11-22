#!/usr/bin/env node

/**
 * Активация workflow "Парсинг автомобилей раз в 5 min"
 */

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const WORKFLOW_ID = 'u3cOUuoaH5RSw7hm';

async function activateWorkflow() {
  console.log('🔧 Активация workflow "Парсинг автомобилей"...\n');

  try {
    // Получаем текущий workflow
    console.log('1️⃣ Получение workflow...');
    const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to get workflow: ${getResponse.status} ${getResponse.statusText}`);
    }

    const workflow = await getResponse.json();
    console.log('   Ответ:', JSON.stringify(workflow, null, 2));
    console.log(`   Текущий статус: ${workflow.data?.active ? '✅ Активен' : '❌ Неактивен'}\n`);

    if (workflow.data?.active) {
      console.log('✅ Workflow уже активен!');
      return;
    }

    // Активируем workflow
    console.log('2️⃣ Активация workflow...');
    const activateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PATCH',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ active: true })
    });

    if (!activateResponse.ok) {
      const error = await activateResponse.text();
      throw new Error(`Failed to activate workflow: ${activateResponse.status} ${activateResponse.statusText}\n${error}`);
    }

    const result = await activateResponse.json();
    console.log(`   ✅ Workflow активирован!\n`);

    console.log('📋 Детали:');
    console.log(`   ID: ${result.data.id}`);
    console.log(`   Name: ${result.data.name}`);
    console.log(`   Active: ${result.data.active ? '✅' : '❌'}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${result.data.id}`);

    console.log('\n🎯 Workflow будет запускаться каждые 5 минут!');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  }
}

activateWorkflow().catch(console.error);

