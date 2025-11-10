#!/usr/bin/env node
/**
 * Удаление дубликатов workflow "Restore Cars from RentProg (Scheduled)"
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const TARGET_NAME = 'Restore Cars from RentProg (Scheduled)';

async function removeDuplicates() {
  try {
    console.log('🔍 Поиск дубликатов workflow...\n');

    // Получаем список всех workflow
    const response = await fetch(`${N8N_HOST}/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    const workflows = result.data || [];

    // Находим все workflow с нужным именем
    const duplicates = workflows.filter(wf => wf.name === TARGET_NAME);

    if (duplicates.length === 0) {
      console.log('❌ Workflow с таким именем не найден');
      return;
    }

    if (duplicates.length === 1) {
      console.log('✅ Дубликатов не найдено. Только один workflow с таким именем.');
      console.log(`   ID: ${duplicates[0].id}`);
      return;
    }

    console.log(`📋 Найдено дубликатов: ${duplicates.length}\n`);

    // Сортируем по дате создания (новые первыми)
    duplicates.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.updatedAt || 0);
      const dateB = new Date(b.createdAt || b.updatedAt || 0);
      return dateB - dateA;
    });

    // Оставляем первый (самый новый), удаляем остальные
    const keepId = duplicates[0].id;
    const toDelete = duplicates.slice(1);

    console.log(`✅ Оставляем workflow: ${keepId}`);
    console.log(`   Создан: ${duplicates[0].createdAt || 'N/A'}\n`);

    for (const wf of toDelete) {
      console.log(`🗑️  Удаляем дубликат: ${wf.id}`);
      console.log(`   Создан: ${wf.createdAt || 'N/A'}`);

      const deleteResponse = await fetch(`${N8N_HOST}/workflows/${wf.id}`, {
        method: 'DELETE',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY
        }
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error(`   ❌ Ошибка при удалении: HTTP ${deleteResponse.status}: ${errorText}`);
      } else {
        console.log(`   ✅ Удален успешно\n`);
      }
    }

    console.log('━'.repeat(50));
    console.log('✅ Готово! Дубликаты удалены.');
    console.log(`   Оставлен workflow: ${keepId}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${keepId}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

removeDuplicates();

