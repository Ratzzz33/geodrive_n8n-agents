#!/usr/bin/env node
/**
 * Валидация RENTPROG_BRANCH_KEYS и тестирование получения токенов
 * Используется в GitHub Actions workflow: test-rentprog-tokens.yml
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const keysStr = process.env.RENTPROG_BRANCH_KEYS || '';
const baseUrl = process.env.RENTPROG_BASE_URL || 'https://rentprog.net/api/v1/public';

console.log('🔍 Проверяю RENTPROG_BRANCH_KEYS...');
console.log('Длина строки RENTPROG_BRANCH_KEYS:', keysStr.length);
console.log('Первые 100 символов:', keysStr.substring(0, 100));

// Валидация JSON
let keys;
try {
  keys = JSON.parse(keysStr);
  console.log('✅ JSON валиден');
  console.log('Филиалы:', Object.keys(keys).join(', '));
  
  // Проверка пустых ключей
  for (const [branch, key] of Object.entries(keys)) {
    if (!key || key.trim() === '') {
      console.error(`❌ Ключ для ${branch} пустой`);
      process.exit(1);
    } else {
      console.log(`✅ ${branch}: ключ есть (длина: ${key.length})`);
    }
  }
} catch (e) {
  console.error('❌ Ошибка парсинга JSON:', e.message);
  console.log('Первые 200 символов:', keysStr.substring(0, 200));
  process.exit(1);
}

console.log('');
console.log('🔍 Тестирую получение токенов для каждого филиала...');

/**
 * Тестирование получения токена для филиала
 */
async function testToken(branch, key) {
  try {
    const url = `${baseUrl}/get_token?company_token=${key}`;
    console.log(`Тестирую ${branch}...`);
    
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              if (json.token) {
                console.log(`✅ ${branch}: токен получен (exp: ${json.exp})`);
                resolve(true);
              } else {
                console.error(`❌ ${branch}: токен не найден в ответе`);
                resolve(false);
              }
            } catch (e) {
              console.error(`❌ ${branch}: ошибка парсинга ответа:`, e.message);
              console.log('Ответ:', data.substring(0, 200));
              resolve(false);
            }
          } else {
            console.error(`❌ ${branch}: HTTP ${res.statusCode}`);
            console.log('Ответ:', data.substring(0, 200));
            resolve(false);
          }
        });
      });
      
      req.on('error', (e) => {
        console.error(`❌ ${branch}: ошибка запроса:`, e.message);
        resolve(false);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        console.error(`❌ ${branch}: таймаут`);
        resolve(false);
      });
    });
  } catch (e) {
    console.error(`❌ ${branch}: ошибка:`, e.message);
    return false;
  }
}

// Запуск тестов
(async () => {
  const results = await Promise.all([
    testToken('tbilisi', keys.tbilisi),
    testToken('batumi', keys.batumi),
    testToken('kutaisi', keys.kutaisi),
    testToken('service-center', keys['service-center']),
  ]);
  
  const allOk = results.every(r => r);
  
  console.log('');
  if (allOk) {
    console.log('✅ Все токены получены успешно');
    process.exit(0);
  } else {
    console.error('❌ Не все токены получены');
    process.exit(1);
  }
})();

