#!/usr/bin/env node
/**
 * Прогон тестового вебхука через workflow
 */

const N8N_WEBHOOK_URL = 'https://n8n.rentflow.rentals/webhook/tbilisi-webhook';

async function triggerTestWebhook() {
  console.log('📤 Отправляю тестовый вебхук с NULL значениями...\n');
  
  // Тестовый payload с NULL значениями (имитация реального вебхука)
  const testPayload = {
    event: 'booking_update',
    payload: {
      id: 515772,
      responsible: [null, null],  // NULL значения
      responsible_id: [null, null],  // NULL значения
      user_id: null,  // NULL значение
      price: [100, 150],  // Нормальное изменение
      state: [1, 2]  // Нормальное изменение
    }
  };
  
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    console.log(`✅ Ответ от workflow: ${JSON.stringify(result, null, 2)}`);
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      console.log('\n✅ Вебхук успешно обработан!');
      console.log('   Проверьте execution в n8n UI для деталей');
    } else {
      console.log('\n⚠️  Вебхук обработан с ошибкой');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при отправке вебхука:', error.message);
  }
}

triggerTestWebhook()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

