#!/usr/bin/env node
/**
 * Список всех workflow с именем "API Starline parser"
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function listStarlineWorkflows() {
  console.log('🔍 Ищу все workflow с именем "API Starline parser"...\n');

  try {
    const listResponse = await fetch(`${N8N_HOST}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Ошибка получения списка workflows: ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    console.log('📋 Структура ответа:', JSON.stringify(listData, null, 2).substring(0, 500));
    
    // Пробуем разные варианты структуры
    const workflows = listData.data?.data || listData.data || listData || [];

    console.log(`\n📊 Всего workflow: ${workflows.length}\n`);

    // Находим все workflow с именем содержащим "Starline" или "starline"
    const starlineWorkflows = workflows.filter(wf => 
      wf && wf.name && (wf.name.toLowerCase().includes('starline') || wf.name.includes('Starline'))
    );

    console.log(`📊 Найдено workflow со словом "Starline": ${starlineWorkflows.length}\n`);

    if (starlineWorkflows.length === 0) {
      console.log('✅ Workflow не найдены!\n');
      return;
    }

    starlineWorkflows.forEach((wf, index) => {
      console.log(`${index + 1}. ${wf.name}`);
      console.log(`   ID: ${wf.id}`);
      console.log(`   Active: ${wf.active ? '✅' : '❌'}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${wf.id}\n`);
    });

    // Находим дубликаты (кроме 34DYNGsToUYrCvDj)
    const duplicates = starlineWorkflows.filter(wf => 
      wf.name === 'API Starline parser 1 min' && wf.id !== '34DYNGsToUYrCvDj'
    );

    if (duplicates.length > 0) {
      console.log(`\n🗑️  Дубликаты для удаления: ${duplicates.length}\n`);
      duplicates.forEach((wf, index) => {
        console.log(`${index + 1}. ${wf.name} (ID: ${wf.id})`);
      });
    } else {
      console.log('\n✅ Дубликатов не найдено!\n');
    }

  } catch (error) {
    console.error('❌ Ошибка:');
    console.error(error.message);
    process.exit(1);
  }
}

listStarlineWorkflows();

