// Тестовый вебхук для Автосервиса
import axios from 'axios';

const webhookUrl = 'https://webhook.rentflow.rentals/webhook/service-center-webhook';

const testPayload = {
  event: 'car_update',
  payload: JSON.stringify({
    id: 99999,
    car_name: 'Test Car',
    state: [null, 'active'],
    mileage: [10000, 10100],
    updated_at: new Date().toISOString()
  })
};

console.log('Sending test webhook to:', webhookUrl);
console.log('Payload:', JSON.stringify(testPayload, null, 2));

try {
  const response = await axios.post(webhookUrl, testPayload, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000
  });
  
  console.log('\n✅ Response:', response.status, response.statusText);
  console.log('Data:', response.data);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  }
}

