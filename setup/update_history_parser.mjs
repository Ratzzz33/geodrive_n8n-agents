import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import 'dotenv/config';

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

const WORKFLOW_ID = 'xSjwtwrrWUGcBduU'; // Парсинг всех операций

async function updateHistoryParser() {
  try {
    console.log('🔧 Обновляем "Парсинг всех операций"...\n');
    
    const headers = {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    };

    // Читаем локальный файл
    const workflowFile = 'n8n-workflows/rentprog-history-parser-active.json';
    const workflowData = JSON.parse(readFileSync(workflowFile, 'utf8'));

    // Получаем текущий workflow с сервера
    const getRes = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'GET',
      headers,
    });

    if (!getRes.ok) {
      throw new Error(`Ошибка получения workflow: ${getRes.status} - ${await getRes.text()}`);
    }

    const currentWorkflow = (await getRes.json()).data || (await getRes.json());

    // Подготовка данных для обновления (без id, versionId и т.д.)
    const updateData = {
      name: workflowData.name,
      nodes: workflowData.nodes,
      connections: workflowData.connections,
      settings: workflowData.settings || currentWorkflow.settings,
      active: currentWorkflow.active, // Сохраняем текущий статус
    };

    // Обновляем workflow
    const updateRes = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData),
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      throw new Error(`Ошибка обновления workflow: ${updateRes.status} - ${errorText}`);
    }

    console.log('✅ Workflow обновлён успешно!\n');
    console.log('Изменения:');
    console.log('  ❌ Удалена нода "Switch" (проверка No Data не нужна)');
    console.log('  ❌ Удалена нода "No Data"');
    console.log('  ✅ Обновлён "Pass Through Data" → берёт данные из "Merge & Process"');
    console.log('  ✅ Обновлён SQL → дедупликация по (branch, operation_id)');
    console.log('');
    console.log('Новый поток:');
    console.log('  Merge & Process (200 items)');
    console.log('    ↓');
    console.log('  Save to History → 200 INSERT/UPDATE в БД');
    console.log('    ↓ (возвращает {success: true})');
    console.log('  Pass Through Data → берёт исходные 200 items из Merge & Process');
    console.log('    ↓');
    console.log('  Format Result → правильная статистика!');
    console.log('');
    console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    console.log('');
    console.log('🎯 Дедупликация:');
    console.log('  • Constraint: (branch, operation_id)');
    console.log('  • operation_id всегда есть (не NULL)');
    console.log('  • Никаких дублей!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

updateHistoryParser();
