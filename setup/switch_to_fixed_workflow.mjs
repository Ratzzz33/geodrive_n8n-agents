import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const OLD_WORKFLOW_ID = 'tx0QQ0soDfPzQuUp'; // Старый Sequential
const NEW_WORKFLOW_ID = 'SLW5V3xUSKsyVYGE'; // Fixed

async function deactivateWorkflow(workflowId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}/workflows/${workflowId}/deactivate`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': N8N_API_KEY
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write('{}');
    req.end();
  });
}

async function main() {
  console.log('🔄 Переключение на Fixed Upsert Processor...\n');

  // Деактивируем старый
  console.log(`1️⃣  Деактивируем старый workflow (${OLD_WORKFLOW_ID})...`);
  const result = await deactivateWorkflow(OLD_WORKFLOW_ID);
  
  if (result.success) {
    console.log('   ✅ Старый workflow деактивирован\n');
  } else {
    console.log('   ⚠️  Ошибка деактивации (возможно уже деактивирован)\n');
  }

  console.log('═'.repeat(70));
  console.log('\n✅ ГОТОВО!\n');
  console.log('Теперь используется ИСПРАВЛЕННЫЙ workflow:');
  console.log(`   ID: ${NEW_WORKFLOW_ID}`);
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/${NEW_WORKFLOW_ID}`);
  console.log(`   Webhook: /webhook/upsert-processor\n`);
  console.log('📝 Изменения:');
  console.log('   • Добавлена нода "Get RentProg Tokens"');
  console.log('   • Получение временных токенов для всех филиалов');
  console.log('   • HTTP Request ноды используют Authorization headers\n');
  console.log('🧪 Тестируем снова:');
  console.log('   node setup/test_booking_501190.mjs\n');
}

main();

