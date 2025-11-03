// Проверка доступности HTTPS для webhook.rentflow.rentals
import fetch from 'node-fetch';
import https from 'https';

const WEBHOOK_URL = 'https://webhook.rentflow.rentals';

console.log('🔍 Проверка HTTPS доступности webhook.rentflow.rentals...\n');

// 1. Проверка доступности HTTPS
console.log('1️⃣ Проверка доступности HTTPS endpoint...');
try {
  const response = await fetch(`${WEBHOOK_URL}/`, {
    method: 'HEAD',
    redirect: 'manual'
  });
  
  console.log(`   Статус: ${response.status} ${response.statusText}`);
  
  if (response.status === 200 || response.status === 301 || response.status === 302) {
    console.log('   ✅ HTTPS доступен');
  } else {
    console.log(`   ⚠️  Неожиданный статус: ${response.status}`);
  }
} catch (error) {
  console.log(`   ❌ Ошибка при подключении: ${error.message}`);
  console.log('   Возможно, HTTPS не настроен или сертификат недействителен');
}

// 2. Проверка SSL сертификата
console.log('\n2️⃣ Проверка SSL сертификата...');
try {
  const httpsModule = await import('https');
  const options = {
    hostname: 'webhook.rentflow.rentals',
    port: 443,
    method: 'GET',
    rejectUnauthorized: false // Чтобы не падало на самоподписанных сертификатах
  };
  
  const req = https.request(options, (res) => {
    console.log(`   Статус: ${res.statusCode}`);
    console.log(`   ✅ Соединение установлено`);
    
    // Проверить информацию о сертификате
    const cert = res.socket.getPeerCertificate();
    if (cert && cert.subject) {
      console.log(`   Сертификат: ${cert.subject.CN || cert.subject.altName || 'не указан'}`);
      if (cert.valid_to) {
        const validTo = new Date(cert.valid_to);
        console.log(`   Действителен до: ${validTo.toLocaleDateString('ru-RU')}`);
      }
    }
  });
  
  req.on('error', (error) => {
    console.log(`   ❌ Ошибка: ${error.message}`);
  });
  
  req.end();
  
  // Подождать немного для завершения запроса
  await new Promise(resolve => setTimeout(resolve, 2000));
  
} catch (error) {
  console.log(`   ❌ Ошибка проверки SSL: ${error.message}`);
}

// 3. Тестовый POST запрос
console.log('\n3️⃣ Тестовый POST запрос...');
try {
  const testPayload = {
    ts: new Date().toISOString(),
    branch: 'diagnostic_test',
    type: 'diagnostic',
    payload: { id: 'https_test_' + Date.now() },
    ok: true
  };
  
  const response = await fetch(`${WEBHOOK_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });
  
  const responseText = await response.text();
  
  console.log(`   Статус: ${response.status} ${response.statusText}`);
  console.log(`   Ответ: ${responseText.substring(0, 200)}`);
  
  if (response.status === 200 && responseText.includes('ok')) {
    console.log('   ✅ POST запрос проходит успешно');
  } else {
    console.log('   ⚠️  POST запрос не проходит или возвращает ошибку');
  }
  
} catch (error) {
  console.log(`   ❌ Ошибка POST запроса: ${error.message}`);
}

// 4. Рекомендации
console.log('\n📋 Рекомендации:');
console.log('   Для полной проверки на сервере выполните:');
console.log('   ssh root@46.224.17.15');
console.log('   bash <(curl -s https://raw.githubusercontent.com/ваш-репозиторий/setup/verify_nginx_ssl.sh)');
console.log('\n   Или вручную:');
console.log('   grep -E "listen|ssl" /etc/nginx/sites-available/webhook.rentflow.rentals.conf');
console.log('   tail -20 /var/log/nginx/webhook-access.log');
console.log('   tail -20 /var/log/nginx/webhook-error.log');

