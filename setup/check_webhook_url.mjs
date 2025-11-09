import axios from 'axios';

// Проверим рабочий вебхук (Тбилиси)
const urls = [
  'https://webhook.rentflow.rentals/webhook/tbilisi-webhook',
  'https://webhook.rentflow.rentals/webhook/service-center-webhook',
  'https://webhook.rentflow.rentals/webhook-test/service-center-webhook',
];

for (const url of urls) {
  try {
    const response = await axios.post(url, {event: 'test'}, {timeout: 5000});
    console.log(`✅ ${url} - ${response.status}`);
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${url} - ${error.response.status}: ${error.response.data?.message || error.response.data}`);
    } else {
      console.log(`❌ ${url} - ${error.message}`);
    }
  }
}

