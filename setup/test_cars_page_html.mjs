import https from 'https';
import fs from 'fs';

// JWT токены из браузера (вечные)
const JWT_TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4'
};

async function getCarsPage(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'web.rentprog.ru',
      path: '/cars',
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${token}`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://web.rentprog.ru/',
        'Connection': 'keep-alive'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

console.log('🔍 Запрашиваю страницу /cars с JWT токеном...\n');

try {
  const html = await getCarsPage(JWT_TOKENS.tbilisi);
  
  // Сохраняем HTML
  fs.writeFileSync('setup/cars_page_with_jwt.html', html, 'utf-8');
  
  console.log(`📄 HTML сохранен в setup/cars_page_with_jwt.html`);
  console.log(`📏 Размер: ${html.length} байт\n`);
  
  // Проверяем что внутри
  if (html.includes('<div id="app">')) {
    console.log('⚠️  Это пустая SPA страница (Vue.js) - данные загружаются через JavaScript!');
    console.log('\n💡 РЕШЕНИЕ: Нужно перехватить AJAX запрос, который делает браузер после загрузки!');
    console.log('   Скорее всего это POST запрос к /api/v1/search_operations или подобному.');
  } else if (html.includes('<table')) {
    console.log('✅ HTML содержит таблицу! Можно парсить.');
    
    // Ищем таблицу
    const tableMatch = html.match(/<table[^>]*>(.*?)<\/table>/s);
    if (tableMatch) {
      const tableContent = tableMatch[0].substring(0, 500);
      console.log('\n📋 Начало таблицы:');
      console.log(tableContent);
    }
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}

