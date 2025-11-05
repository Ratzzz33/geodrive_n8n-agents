import https from 'https';

const COMPANY_TOKEN = '5y4j4gcs75o9n5s1e2vrxx4a'; // service-center
const BASE_URL = 'https://rentprog.net/api/v1/public';

async function getToken() {
  return new Promise((resolve, reject) => {
    const req = https.request(`${BASE_URL}/get_token?company_token=${COMPANY_TOKEN}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.token);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getWebhooks(token) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(`${BASE_URL}/webhook_subscriptions`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function updateWebhook(token, webhookId, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(`${BASE_URL}/webhook_subscriptions/${webhookId}`, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function checkWebhooks() {
  console.log('\n🔍 Проверка webhooks в RentProg (Service Center)...\n');

  try {
    console.log('1️⃣ Получение токена...');
    const token = await getToken();
    console.log('   ✓ Токен получен\n');

    console.log('2️⃣ Получение списка webhooks...');
    const webhooks = await getWebhooks(token);
    console.log(`   ✓ Найдено webhooks: ${webhooks.length}\n`);

    webhooks.forEach((webhook, idx) => {
      console.log(`📋 Webhook #${idx + 1} (ID: ${webhook.id}):`);
      console.log(`   URL: ${webhook.url}`);
      console.log(`   Enabled: ${webhook.enabled ? '✅ ДА' : '❌ НЕТ'}`);
      console.log(`   Company ID: ${webhook.company_id}`);
      console.log(`   Subscriptions: ${webhook.subscriptions.length} событий`);
      webhook.subscriptions.forEach(sub => console.log(`      - ${sub}`));
      console.log(`   Created: ${webhook.created_at}`);
      console.log(`   Updated: ${webhook.updated_at}\n`);
    });

    // Найти webhook для service-center
    const serviceWebhook = webhooks.find(w => 
      w.company_id === 11163 && 
      w.url.includes('service-center-webhook')
    );

    if (serviceWebhook) {
      console.log('🎯 Найден Service Center webhook!\n');

      if (!serviceWebhook.enabled) {
        console.log('⚠️  Webhook ОТКЛЮЧЕН. Включаем...\n');
        
        const updated = await updateWebhook(token, serviceWebhook.id, {
          url: 'https://n8n.rentflow.rentals/webhook/service-center-webhook',
          enabled: true,
          subscriptions: [
            'booking_create', 'booking_update', 'booking_destroy',
            'car_create', 'car_update', 'car_destroy',
            'client_create', 'client_update', 'client_destroy'
          ]
        });

        console.log('✅ Webhook обновлен!');
        console.log(`   ID: ${updated.id}`);
        console.log(`   URL: ${updated.url}`);
        console.log(`   Enabled: ${updated.enabled ? '✅ ДА' : '❌ НЕТ'}`);
        console.log(`   Subscriptions: ${updated.subscriptions.join(', ')}\n`);
      } else {
        console.log('✅ Webhook уже включен!\n');
      }
    } else {
      console.log('❌ Service Center webhook НЕ найден!');
      console.log('💡 Нужно создать webhook через RentProg UI или API\n');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

checkWebhooks();

