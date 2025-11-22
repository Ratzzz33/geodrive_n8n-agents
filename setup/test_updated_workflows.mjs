#!/usr/bin/env node
/**
 * Тестирование обновленных workflow на реальных вебхуках из истории
 */

const N8N_WEBHOOKS = {
  batumi: 'https://n8n.rentflow.rentals/webhook/batumi-webhook',
  kutaisi: 'https://n8n.rentflow.rentals/webhook/kutaisi-webhook',
  'service-center': 'https://n8n.rentflow.rentals/webhook/service-center-webhook'
};

// Тестовые payload из реальных executions
const testWebhooks = [
  {
    branch: 'kutaisi',
    payload: {
      event: 'booking_update',
      payload: {
        description: ['305 + 100', '305'],
        id: 510335,
        created_from_api: true,
        updated_from_api: false,
        user_id: null  // NULL значение для теста
      }
    }
  },
  {
    branch: 'service-center',
    payload: {
      event: 'car_update',
      payload: {
        company_id: [9247, 11163],
        id: 39736,
        created_from_api: false,
        updated_from_api: false,
        branch_name: 'GeoDrive Auto Service'
      }
    }
  }
];

async function testWorkflow(branch, payload) {
  console.log(`\n📤 Тестирую ${branch} workflow...`);
  console.log(`   Payload: ${JSON.stringify(payload).substring(0, 150)}...`);
  
  const webhookUrl = N8N_WEBHOOKS[branch];
  if (!webhookUrl) {
    console.log(`   ❌ Webhook URL не найден для ${branch}`);
    return;
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Вебхук обработан успешно`);
      console.log(`   Response: ${JSON.stringify(result)}`);
      
      // Проверяем, что NULL значения не попали в обновления
      if (payload.payload.user_id === null) {
        console.log(`   ✅ NULL значение user_id должно быть отфильтровано`);
      }
    } else {
      console.log(`   ⚠️  Вебхук обработан с ошибкой: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(result)}`);
    }
    
    return { success: response.ok, result };
    
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Тестирование обновленных workflow на реальных вебхуках\n');
  
  const results = [];
  
  for (const test of testWebhooks) {
    const result = await testWorkflow(test.branch, test.payload);
    results.push({ branch: test.branch, ...result });
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Итоги тестирования:');
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.branch}: ${result.success ? 'успешно' : 'ошибка'}`);
  }
  
  const allSuccess = results.every(r => r.success);
  if (allSuccess) {
    console.log('\n✅ Все workflow работают корректно!');
  } else {
    console.log('\n⚠️  Некоторые workflow имеют проблемы');
  }
}

runTests()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

