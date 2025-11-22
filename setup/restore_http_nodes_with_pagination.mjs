#!/usr/bin/env node
/**
 * Восстановление HTTP Request нод для RentProg с добавлением пагинации
 * Сохраняет все оригинальные ноды, но добавляет промежуточную Code-ноду для догрузки страниц
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workflowPath = join(__dirname, '..', 'n8n-workflows', '_RentProg__Active_Bookings.json');

console.log('🔄 Восстановление HTTP нод с пагинацией...\n');

// Читаем текущий workflow
const content = await fs.readFile(workflowPath, 'utf8');
const workflow = JSON.parse(content);

// Оригинальные HTTP Request ноды для 4 филиалов
const httpNodes = [
  {
    parameters: {
      method: 'POST',
      url: 'https://rentprog.net/api/v1/index_with_search',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk' },
          { name: 'Accept', value: 'application/json' },
          { name: 'Origin', value: 'https://web.rentprog.ru' },
          { name: 'Referer', value: 'https://web.rentprog.ru/' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={"model":"booking","page":1,"per_page":50,"filters":{"start_date_from":"2025-10-14","state":["Активная","Новая"]}}',
      options: { timeout: 60000 },
    },
    name: 'Get Tbilisi Active',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [480, 208],
    id: '0795bf53-6203-47e5-a9d4-4a4de445d8fa',
  },
  {
    parameters: {
      method: 'POST',
      url: 'https://rentprog.net/api/v1/index_with_search',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDAyNSwiZXhwIjoxNzY1MDUyMDI1LCJqdGkiOiI0ZmQ2ODE4Yy0zYWNiLTRmZmQtOGZmYS0wZWMwZDkyMmIyMzgifQ.16s2ruRb3x_S7bgy4zF7TW9dSQ3ITqX3kei8recyH_8' },
          { name: 'Accept', value: 'application/json' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={"model":"booking","page":1,"per_page":50,"filters":{"start_date_from":"2025-10-14","state":["Активная","Новая"]}}',
      options: { timeout: 60000 },
    },
    name: 'Get Batumi Active',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [480, 400],
    id: 'f4e60080-2fce-4fbd-8def-450fdd2f9715',
  },
  {
    parameters: {
      method: 'POST',
      url: 'https://rentprog.net/api/v1/index_with_search',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDE3MiwiZXhwIjoxNzY1MDUyMTcyLCJqdGkiOiJmNzE1NGQ3MC0zZWFmLTRiNzItYTI3Ni0yZTg3MmQ4YjA0YmQifQ.1vd1kNbWB_qassLVqoxgyRsRJwtPsl7OR28gVsCxmwY' },
          { name: 'Accept', value: 'application/json' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={"model":"booking","page":1,"per_page":50,"filters":{"start_date_from":"2025-10-14","state":["Активная","Новая"]}}',
      options: { timeout: 60000 },
    },
    name: 'Get Kutaisi Active',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [480, 608],
    id: '1f5cd836-3b4b-4e2e-a91c-4e28f2c6db22',
  },
  {
    parameters: {
      method: 'POST',
      url: 'https://rentprog.net/api/v1/index_with_search',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTM4MSwiZXhwIjoxNzY1MDUxMzgxLCJqdGkiOiI4ZDdkYjYyNi1jNWJiLTQ0MWMtYTNlMy00YjQwOWFmODQ1NmUifQ.32BRzttLFFgOgMv-VusAXK8mmyvrk4X-pb_rHQHSFbw' },
          { name: 'Accept', value: 'application/json' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={"model":"booking","page":1,"per_page":50,"filters":{"start_date_from":"2025-10-14","state":["Активная","Новая"]}}',
      options: { timeout: 60000 },
    },
    name: 'Get Service Active',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [480, 800],
    id: 'e034b4b1-1e9a-45c3-b5d7-a4ed61e053fc',
  },
];

// Merge All Branches нода
const mergeNode = {
  parameters: { numberInputs: 4 },
  name: 'Merge All Branches',
  type: 'n8n-nodes-base.merge',
  typeVersion: 3,
  position: [720, 560],
  id: 'f151b280-d837-4550-911e-66440d396a28',
};

// Pagination нода - догружает страницы 2+ если на странице 1 было ровно 50 записей
const paginationNode = {
  parameters: {
    jsCode: `// Догружаем дополнительные страницы если нужно
const items = $input.all();
const results = [];

// Маппинг филиалов для токенов
const branchTokens = {
  'Get Tbilisi Active': {
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk',
    extraHeaders: { Origin: 'https://web.rentprog.ru', Referer: 'https://web.rentprog.ru/' },
    branch: 'tbilisi'
  },
  'Get Batumi Active': {
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDAyNSwiZXhwIjoxNzY1MDUyMDI1LCJqdGkiOiI0ZmQ2ODE4Yy0zYWNiLTRmZmQtOGZmYS0wZWMwZDkyMmIyMzgifQ.16s2ruRb3x_S7bgy4zF7TW9dSQ3ITqX3kei8recyH_8',
    branch: 'batumi'
  },
  'Get Kutaisi Active': {
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDE3MiwiZXhwIjoxNzY1MDUyMTcyLCJqdGkiOiJmNzE1NGQ3MC0zZWFmLTRiNzItYTI3Ni0yZTg3MmQ4YjA0YmQifQ.1vd1kNbWB_qassLVqoxgyRsRJwtPsl7OR28gVsCxmwY',
    branch: 'kutaisi'
  },
  'Get Service Active': {
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTM4MSwiZXhwIjoxNzY1MDUxMzgxLCJqdGkiOiI4ZDdkYjYyNi1jNWJiLTQ0MWMtYTNlMy00YjQwOWFmODQ1NmUifQ.32BRzttLFFgOgMv-VusAXK8mmyvrk4X-pb_rHQHSFbw',
    branch: 'service-center'
  }
};

for (const item of items) {
  const json = item.json;
  const nodeName = item.pairedItem?.item !== undefined 
    ? Object.keys(branchTokens)[item.pairedItem.item] 
    : null;
  
  const config = nodeName ? branchTokens[nodeName] : null;
  
  // Добавляем первую страницу
  const firstPageData = json.bookings?.data || [];
  const aggregated = [...firstPageData];
  
  // Если пришло ровно 50 записей - догружаем остальные страницы
  if (firstPageData.length === 50 && config) {
    let page = 2;
    
    while (page <= 50) { // защита от бесконечного цикла
      const body = {
        model: 'booking',
        page,
        per_page: 50,
        filters: {
          start_date_from: '2025-10-14',
          state: ['Активная', 'Новая']
        }
      };
      
      const headers = {
        Authorization: config.token,
        Accept: 'application/json',
        ...(config.extraHeaders || {})
      };
      
      const response = await this.helpers.httpRequest({
        method: 'POST',
        uri: 'https://rentprog.net/api/v1/index_with_search',
        headers,
        body,
        json: true,
        timeout: 60000
      });
      
      const pageData = response?.bookings?.data || [];
      aggregated.push(...pageData);
      
      if (pageData.length < 50) {
        break;
      }
      
      page += 1;
    }
    
    console.log(\`Fetched \${aggregated.length} bookings for \${config.branch} (pages: 1-\${page-1})\`);
  }
  
  // Возвращаем обогащённый результат
  results.push({
    json: {
      ...json,
      bookings: {
        data: aggregated
      }
    }
  });
}

return results;`,
  },
  name: 'Paginate If Needed',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [840, 560],
  id: 'a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6',
};

// Находим индексы нод которые нужно заменить/добавить
const fetchNodeIndex = workflow.nodes.findIndex(n => n.name === 'Fetch Branch Bookings');
const processNodeIndex = workflow.nodes.findIndex(n => n.name === 'Process All Bookings');

// Удаляем временную Fetch Branch Bookings ноду если она есть
if (fetchNodeIndex !== -1) {
  workflow.nodes.splice(fetchNodeIndex, 1);
}

// Добавляем HTTP ноды в начало (если их нет)
const existingHttpNodes = workflow.nodes.filter(n => 
  ['Get Tbilisi Active', 'Get Batumi Active', 'Get Kutaisi Active', 'Get Service Active'].includes(n.name)
);

if (existingHttpNodes.length === 0) {
  workflow.nodes.unshift(...httpNodes);
}

// Добавляем Merge и Pagination ноды (если их нет)
if (!workflow.nodes.find(n => n.name === 'Merge All Branches')) {
  workflow.nodes.splice(processNodeIndex, 0, mergeNode);
}

if (!workflow.nodes.find(n => n.name === 'Paginate If Needed')) {
  workflow.nodes.splice(processNodeIndex, 0, paginationNode);
}

// Обновляем connections
workflow.connections = {
  'Get Tbilisi Active': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 0 }]]
  },
  'Get Batumi Active': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 1 }]]
  },
  'Get Kutaisi Active': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 2 }]]
  },
  'Get Service Active': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 3 }]]
  },
  'Merge All Branches': {
    main: [[{ node: 'Paginate If Needed', type: 'main', index: 0 }]]
  },
  'Paginate If Needed': {
    main: [[{ node: 'Process All Bookings', type: 'main', index: 0 }]]
  },
  'Get Car IDs': {
    main: [[{ node: 'Process All Bookings', type: 'main', index: 4 }]]
  },
  'Process All Bookings': {
    main: [[{ node: 'Save to DB', type: 'main', index: 0 }]]
  },
  'Save to DB': {
    main: [[{ node: 'Format Result', type: 'main', index: 0 }]]
  },
  'Format Result': {
    main: [[{ node: 'If Error', type: 'main', index: 0 }], []]
  },
  'If Error': {
    main: [
      [{ node: 'Send Alert', type: 'main', index: 0 }],
      [{ node: 'Success', type: 'main', index: 0 }]
    ]
  },
  'Send Alert': {
    main: [[{ node: 'Throw Error', type: 'main', index: 0 }]]
  },
  'Every 5 Minutes': {
    main: [[
      { node: 'Get Tbilisi Active', type: 'main', index: 0 },
      { node: 'Get Batumi Active', type: 'main', index: 0 },
      { node: 'Get Kutaisi Active', type: 'main', index: 0 },
      { node: 'Get Service Active', type: 'main', index: 0 },
      { node: 'Get Car IDs', type: 'main', index: 0 }
    ]]
  }
};

// Обновляем Process All Bookings - меняем предупреждение обратно на Merge
const processNode = workflow.nodes.find(n => n.name === 'Process All Bookings');
if (processNode && processNode.parameters.jsCode) {
  processNode.parameters.jsCode = processNode.parameters.jsCode.replace(
    'console.warn(\'⚠️  Нет данных от Fetch Branch Bookings\');',
    'console.warn(\'⚠️  Нет данных от Paginate If Needed\');'
  );
}

await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('✅ HTTP ноды восстановлены с пагинацией!');
console.log('   - 4 HTTP Request ноды (первая страница)');
console.log('   - Merge All Branches (объединение)');
console.log('   - Paginate If Needed (догрузка страниц 2+)');
console.log('   - Process All Bookings (обработка)\n');

