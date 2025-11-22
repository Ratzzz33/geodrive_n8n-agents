#!/usr/bin/env node
/**
 * Удаление дубликатов Starline API workflow через MCP n8n
 * Оставляет только workflow с ID 34DYNGsToUYrCvDj
 * 
 * Использование: node setup/cleanup_starline_duplicates_mcp.mjs
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KEEP_WORKFLOW_ID = '34DYNGsToUYrCvDj';
const WORKFLOW_NAME = 'API Starline parser 1 min';

/**
 * Вызов MCP инструмента через stdin/stdout
 */
async function callMCPTool(toolName, args) {
  return new Promise((resolve, reject) => {
    // Используем MCP через Cursor - но для скрипта используем прямой API
    // Вместо этого используем прямой REST API n8n
    resolve(null);
  });
}

/**
 * Получение списка workflow через REST API
 */
async function listWorkflows() {
  const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
  const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

  const response = await fetch(`${N8N_HOST}/workflows`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения списка workflows: ${response.statusText}`);
  }

  const data = await response.json();
  // Пробуем разные варианты структуры ответа
  return data.data?.data || data.data || data || [];
}

/**
 * Удаление workflow через REST API
 */
async function deleteWorkflow(workflowId) {
  const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
  const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'DELETE',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });

  return response.ok;
}

async function cleanupDuplicates() {
  console.log('🧹 Удаляю дубликаты Starline API workflow...\n');
  console.log(`📌 Оставляю только: ${KEEP_WORKFLOW_ID}\n`);

  try {
    // Получаем список всех workflow
    console.log('🔍 Получаю список workflow через n8n API...');
    const workflows = await listWorkflows();

    console.log(`📊 Всего workflow: ${workflows.length}\n`);

    // Находим все workflow с нужным именем
    const starlineWorkflows = workflows.filter(wf => 
      wf && wf.name && wf.name === WORKFLOW_NAME
    );

    console.log(`📋 Найдено workflow "${WORKFLOW_NAME}": ${starlineWorkflows.length}\n`);

    if (starlineWorkflows.length === 0) {
      console.log('✅ Workflow с таким именем не найдены!\n');
      return;
    }

    // Показываем все найденные
    starlineWorkflows.forEach((wf, index) => {
      const isKeep = wf.id === KEEP_WORKFLOW_ID;
      console.log(`${index + 1}. ${wf.name} (ID: ${wf.id}) ${isKeep ? '✅ ОСТАВИТЬ' : '🗑️  УДАЛИТЬ'}`);
    });

    // Находим дубликаты (кроме нужного)
    const duplicates = starlineWorkflows.filter(wf => wf.id !== KEEP_WORKFLOW_ID);

    console.log(`\n🗑️  Дубликатов для удаления: ${duplicates.length}\n`);

    if (duplicates.length === 0) {
      console.log('✅ Дубликатов не найдено!\n');
      return;
    }

    // Удаляем каждый дубликат
    for (const duplicate of duplicates) {
      console.log(`🗑️  Удаляю: ${duplicate.name} (ID: ${duplicate.id})...`);
      
      try {
        const success = await deleteWorkflow(duplicate.id);
        if (success) {
          console.log(`   ✅ Удален\n`);
        } else {
          console.log(`   ❌ Ошибка удаления\n`);
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

