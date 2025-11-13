#!/usr/bin/env node
/**
 * Исправление ноды "Format Result" - исправление ошибки с err.message.substring
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function updateWorkflow() {
  console.log(`\n🔧 Исправление ноды "Format Result"...`);
  
  // Получаем текущий workflow
  const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow: ${getResponse.statusText}`);
  }
  
  const current = await getResponse.json();
  console.log(`✅ Получен workflow: ${current.name}`);
  
  // Находим ноду Format Result
  const formatNode = current.nodes.find(n => n.name === 'Format Result');
  
  if (!formatNode) {
    throw new Error('Node "Format Result" not found');
  }
  
  console.log('✅ Найдена нода "Format Result"');
  
  // Новый код с правильной обработкой ошибок
  const newCode = `// Формируем результат выполнения
const saveResult = $input.first().json;

let message = '📋 Парсинг броней RentProg через API:\\n\\n';

// Статистика по филиалам
const branches = {
  tbilisi: { active: 0, inactive: 0 },
  batumi: { active: 0, inactive: 0 },
  kutaisi: { active: 0, inactive: 0 },
  'service-center': { active: 0, inactive: 0 }
};

// Подсчитываем брони по филиалам
if (saveResult.saved && Array.isArray(saveResult.saved)) {
  saveResult.saved.forEach(booking => {
    const branch = booking.branch;
    const isActive = booking.is_active;
    
    if (branches[branch]) {
      if (isActive) {
        branches[branch].active++;
      } else {
        branches[branch].inactive++;
      }
    }
  });
}

// Формируем статистику по филиалам
Object.entries(branches).forEach(([branch, counts]) => {
  const branchName = branch.toUpperCase().replace('-', ' ');
  message += \`\${branchName}: \${counts.active} активных / \${counts.inactive} неактивных\\n\`;
});

message += \`\\nВсего обработано: \${saveResult.saved?.length || 0} броней\`;

// Считаем ошибки
let errorCount = 0;
let errorDetails = '';

if (saveResult.errors && Array.isArray(saveResult.errors)) {
  errorCount = saveResult.errors.length;
  
  if (errorCount > 0) {
    message += \`\\n\\n🚨 ОШИБОК: \${errorCount}\\n\`;
    
    saveResult.errors.forEach((err, idx) => {
      // Безопасное получение текста ошибки
      let errorMsg = 'Unknown error';
      
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err && typeof err === 'object') {
        if (typeof err.message === 'string') {
          errorMsg = err.message;
        } else if (err.message && typeof err.message.toString === 'function') {
          errorMsg = err.message.toString();
        } else {
          errorMsg = JSON.stringify(err);
        }
      }
      
      // Обрезаем длинные сообщения
      if (errorMsg.length > 100) {
        errorMsg = errorMsg.substring(0, 100) + '...';
      }
      
      errorDetails += \`\${idx + 1}. \${errorMsg}\\n\`;
    });
    
    message += errorDetails;
    
    // Добавляем ссылку на execution только при ошибках
    message += \`\\n🔗 <a href="https://n8n.rentflow.rentals/workflow/\${$workflow.id}/executions/\${$execution.id}">Открыть execution</a>\`;
  }
}

return {
  json: {
    message: message,
    error_count: errorCount,
    success: errorCount === 0,
    stats: {
      total: saveResult.saved?.length || 0,
      branches: branches,
      errors: errorCount
    }
  }
};`;

  formatNode.parameters.jsCode = newCode;
  console.log('✅ Код ноды обновлен');
  console.log('   → Исправлена обработка err.message');
  console.log('   → Добавлена проверка типов');
  console.log('   → Безопасное преобразование в строку');
  
  // Удаляем id из нод
  current.nodes.forEach(node => {
    delete node.id;
  });
  
  // Создаем чистый объект для обновления
  const updateData = {
    name: current.name,
    nodes: current.nodes,
    connections: current.connections,
    settings: current.settings
  };
  
  // Обновляем workflow
  const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update workflow: ${updateResponse.statusText}\n${errorText}`);
  }
  
  const result = await updateResponse.json();
  console.log(`\n✅ Workflow обновлен успешно!`);
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log(`\n📝 Исправления:`);
  console.log(`  ✅ Безопасная проверка типа err.message`);
  console.log(`  ✅ Преобразование в строку через toString()`);
  console.log(`  ✅ Fallback на JSON.stringify()`);
  console.log(`  ✅ Защита от undefined/null`);
}

updateWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

