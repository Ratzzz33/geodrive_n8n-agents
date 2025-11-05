import fs from 'fs';

const wfPath = 'n8n-workflows/rentprog-upsert-processor-simplified.json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const searchNode = wf.nodes.find(n => n.name === 'Search Entity');

// Обновляем код - добавляем правильные endpoints для bookings
const newCode = `// Ищем сущность по всем филиалам
const branchKeys = {
  "tbilisi": "91b83b93963633649f29a04b612bab3f9fbb0471b5928622",
  "batumi": "7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d",
  "kutaisi": "5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50",
  "service-center": "5y4j4gcs75o9n5s1e2vrxx4a"
};

const baseUrl = 'https://rentprog.net/api/v1/public';
const rentprogId = $input.item.json.rentprog_id;
const entityType = $input.item.json.entity_type;

console.log(\`🔍 Поиск \${entityType} с ID \${rentprogId}\`);

// Мапинг типов на endpoints
const endpoints = {
  'car': '/all_cars_full',
  'client': '/all_clients',
  'booking': '/search_bookings'
};

const endpoint = endpoints[entityType];
if (!endpoint) {
  throw new Error(\`Неизвестный тип сущности: \${entityType}\`);
}

// Ищем по всем филиалам
for (const [branch, companyToken] of Object.entries(branchKeys)) {
  try {
    console.log(\`  → Проверка филиала: \${branch}\`);
    
    // Получаем токен
    const tokenResponse = await this.helpers.httpRequest({
      method: 'GET',
      url: \`\${baseUrl}/get_token\`,
      qs: { company_token: companyToken },
      json: true,
      timeout: 10000
    });
    
    const requestToken = tokenResponse?.token;
    if (!requestToken) {
      console.warn(\`  ⚠️  Не удалось получить токен для \${branch}\`);
      continue;
    }
    
    // Для bookings используем search с query параметром
    let requestUrl = \`\${baseUrl}\${endpoint}\`;
    let requestParams = {
      method: 'GET',
      url: requestUrl,
      headers: { 'Authorization': \`Bearer \${requestToken}\` },
      json: true,
      timeout: 15000
    };
    
    if (entityType === 'booking') {
      // Для bookings: /search_bookings?query={id}
      requestParams.qs = { query: rentprogId };
      console.log(\`  → URL: \${requestUrl}?query=\${rentprogId}\`);
    } else {
      console.log(\`  → URL: \${requestUrl}\`);
    }
    
    // Загружаем сущности
    const response = await this.helpers.httpRequest(requestParams);
    
    const items = Array.isArray(response) ? response : (response.data || []);
    console.log(\`  → Загружено: \${items.length} \${entityType}s\`);
    
    // Ищем нужную сущность
    const found = items.find(item => item.id == rentprogId);
    
    if (found) {
      console.log(\`  ✅ Найдено в \${branch}!\`);
      return [{
        json: {
          ok: true,
          branch: branch,
          entity_type: entityType,
          rentprog_id: rentprogId,
          data: found
        }
      }];
    }
    
  } catch (error) {
    console.error(\`  ❌ Ошибка в \${branch}: \${error.message}\`);
  }
}

// Не найдено ни в одном филиале
console.log('  ❌ Не найдено ни в одном филиале');
return [{
  json: {
    ok: false,
    error: 'Not found in any branch',
    entity_type: entityType,
    rentprog_id: rentprogId
  }
}];`;

searchNode.parameters.jsCode = newCode;

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');

console.log('✅ Обновлен Search Entity node');
console.log('📝 Изменения:');
console.log('   • booking: /all_bookings → /search_bookings?query={id}');
console.log('   • car: /all_cars_full (без изменений)');
console.log('   • client: /all_clients (без изменений)');
console.log('\n🚀 Загружаю в n8n...\n');

