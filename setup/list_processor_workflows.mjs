#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

async function listProcessorWorkflows() {
  console.log('📋 Список processor workflows\n');
  
  try {
    const response = await fetch(`${N8N_HOST}/workflows`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get workflows: ${response.status}`);
    }
    
    const data = await response.json();
    const workflows = data.data || data;
    
    const processors = workflows.filter(w => 
      w.name.includes('Processor Rentprog') || 
      w.name.includes('Processor RentProg')
    );
    
    console.log(`Найдено processor workflows: ${processors.length}\n`);
    
    for (const wf of processors) {
      const branch = wf.name.split(' ')[0].toUpperCase();
      console.log(`${branch}:`);
      console.log(`  ID: ${wf.id}`);
      console.log(`  Name: ${wf.name}`);
      console.log(`  Active: ${wf.active}`);
      console.log(`  URL: https://n8n.rentflow.rentals/workflow/${wf.id}`);
      console.log('');
    }
    
    // Экспортировать для использования в других скриптах
    const config = processors.map(wf => ({
      id: wf.id,
      name: wf.name,
      branch: wf.name.split(' ')[0].toLowerCase(),
      active: wf.active
    }));
    
    console.log('📝 Конфигурация для скрипта:');
    console.log(JSON.stringify(config, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

listProcessorWorkflows();

