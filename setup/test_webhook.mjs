// Тестовый вебхук для проверки обработки
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://webhook.rentflow.rentals/';

const testWebhook = {
  ts: new Date().toISOString(),
  branch: 'tbilisi',
  type: 'booking.issue.planned',
  payload: {
    id: `test_webhook_${Date.now()}`,
    rentprog_id: `test_${Date.now()}`
  },
  ok: true
};

console.log('📤 Отправка тестового вебхука...');
console.log('URL:', WEBHOOK_URL);
console.log('Payload:', JSON.stringify(testWebhook, null, 2));

try {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testWebhook),
  });

  const responseText = await response.text();
  
  console.log(`\n📥 Ответ:`);
  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log(`Body: ${responseText}`);
  
  if (response.ok) {
    console.log('\n✅ Вебхук отправлен успешно');
    console.log(`\n💡 Проверьте в n8n UI:`);
    console.log(`   - Executions workflow "RentProg Webhooks Monitor"`);
    console.log(`   - Таблицу events в БД (должна быть запись)`);
  } else {
    console.log('\n❌ Ошибка отправки вебхука');
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}
