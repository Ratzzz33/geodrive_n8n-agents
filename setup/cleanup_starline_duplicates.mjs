#!/usr/bin/env node
/**
 * Удаление дубликатов Starline API workflow
 * Оставляет только workflow с ID 34DYNGsToUYrCvDj
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const KEEP_WORKFLOW_ID = '34DYNGsToUYrCvDj';
const WORKFLOW_NAME = 'API Starline parser 1 min';

async function cleanupDuplicates() {
  console.log('🧹 Удаляю дубликаты Starline API workflow...\n');
  console.log(`📌 Оставляю только: ${KEEP_WORKFLOW_ID}\n`);

  try {
    // Получаем список всех workflow
    console.log('🔍 Получаю список workflow...');
    const listResponse = await fetch(`${N8N_HOST}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Ошибка получения списка workflows: ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    const workflows = listData.data?.data || [];

    // Находим все workflow с нужным именем
    const duplicates = workflows.filter(wf => 
      wf.name === WORKFLOW_NAME && wf.id !== KEEP_WORKFLOW_ID
    );

    console.log(`📊 Найдено дубликатов: ${duplicates.length}\n`);

    if (duplicates.length === 0) {
      console.log('✅ Дубликатов не найдено!\n');
      return;
    }

    // Удаляем каждый дубликат
    for (const duplicate of duplicates) {
      console.log(`🗑️  Удаляю: ${duplicate.name} (ID: ${duplicate.id})...`);
      
      try {
        const deleteResponse = await fetch(`${N8N_HOST}/workflows/${duplicate.id}`, {
          method: 'DELETE',
          headers: {
            'X-N8N-API-KEY': N8N_API_KEY
          }
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.log(`   ❌ Ошибка: ${deleteResponse.status} - ${errorText}`);
        } else {
          console.log(`   ✅ Удален\n`);
        }
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}\n`);
      }
    }

    console.log('✅ Очистка завершена!\n');
    console.log(`📌 Оставлен workflow: ${KEEP_WORKFLOW_ID}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${KEEP_WORKFLOW_ID}\n`);

  } catch (error) {
    console.error('❌ Ошибка при очистке дубликатов:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

cleanupDuplicates();

