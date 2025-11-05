#!/usr/bin/env node
const API_URL = 'http://46.224.17.15:3000/upsert-car';

async function testEndpoint() {
  console.log(`\n🧪 Тестирование ${API_URL}...\n`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rentprog_id: '37407',
        data_hex: '7b227465737422227d'  // {"test"}
      })
    });

    console.log(`📊 Status: ${response.status}`);
    const text = await response.text();
    console.log(`📦 Response: ${text}`);

    if (response.status === 404) {
      console.log('\n❌ Endpoint НЕ существует');
    } else {
      console.log('\n✅ Endpoint работает');
    }
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
  }
}

testEndpoint();


