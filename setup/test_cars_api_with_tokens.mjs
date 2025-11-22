import https from 'https';

const BRANCH_TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjczOSIsImV4cCI6MTczNzQ5MDE0NX0.Q0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTYU',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.E0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTZV',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.F0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTaW',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.G0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTbX'
};

async function testEndpoint(url, token) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data.substring(0, 500) // Первые 500 символов
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

console.log('🔍 Тестирую /api/v1/public/cars с JWT токеном Tbilisi...\n');

try {
  const result = await testEndpoint(
    'https://rentprog.net/api/v1/public/cars?per_page=5&page=1',
    BRANCH_TOKENS.tbilisi
  );
  
  console.log('📊 Результат:');
  console.log(`Status: ${result.status}`);
  console.log(`Content-Type: ${result.headers['content-type']}`);
  console.log(`\nBody preview:\n${result.body}\n`);
  
  if (result.status === 401) {
    console.log('❌ JWT токен НЕ работает для /api/v1/public/cars');
    console.log('\n💡 Решение: Нужно использовать двухэтапную авторизацию:');
    console.log('   1. company_token -> /get_token -> request_token');
    console.log('   2. request_token -> /api/v1/public/cars');
  } else if (result.status === 200) {
    console.log('✅ JWT токен работает!');
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}

