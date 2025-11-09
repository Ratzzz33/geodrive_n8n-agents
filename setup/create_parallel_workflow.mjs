import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'xSjwtwrrWUGcBduU';
const WORKFLOW_NAME = 'RentProg History Parser';

console.log('🚀 Создаём параллельный workflow с 4 ветками...\n');

// Workflow с 4 параллельными ветками через Switch
const workflow = {
  name: WORKFLOW_NAME,
  nodes: [
    // Trigger
    {
      parameters: {
        rule: { interval: [{ field: "minutes", minutesInterval: 3 }] }
      },
      id: "trigger",
      name: "Every 3 Minutes",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [240, 400]
    },
    // Prepare 4 branches
    {
      parameters: {
        jsCode: `const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
return branches.map(branch => ({
  json: { branch, token: TOKENS[branch] }
}));`
      },
      id: "prepare-branches",
      name: "Prepare Branches",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [440, 400]
    },
    // Switch по филиалам
    {
      parameters: {
        mode: "expression",
        output: "multipleOutputs",
        options: {},
        rules: {
          values: [
            { outputKey: "tbilisi", conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{ $json.branch }}", rightValue: "tbilisi", operator: { type: "string", operation: "equals" } }] } },
            { outputKey: "batumi", conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{ $json.branch }}", rightValue: "batumi", operator: { type: "string", operation: "equals" } }] } },
            { outputKey: "kutaisi", conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{ $json.branch }}", rightValue: "kutaisi", operator: { type: "string", operation: "equals" } }] } },
            { outputKey: "service-center", conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{ $json.branch }}", rightValue: "service-center", operator: { type: "string", operation: "equals" } }] } }
          ]
        },
        fallbackOutput: "none"
      },
      id: "switch-branches",
      name: "Switch by Branch",
      type: "n8n-nodes-base.switch",
      typeVersion: 3,
      position: [640, 400]
    }
  ],
  connections: {
    "Every 3 Minutes": { main: [[{ node: "Prepare Branches", type: "main", index: 0 }]] },
    "Prepare Branches": { main: [[{ node: "Switch by Branch", type: "main", index: 0 }]] }
  },
  settings: {
    timezone: "Asia/Tbilisi",
    executionOrder: "v1",
    errorWorkflow: "H3UBEp425F5SMyrX",
    saveDataErrorExecution: "all",
    saveDataSuccessExecution: "all",
    saveManualExecutions: true
  }
};

console.log('❌ СТОП! n8n не поддерживает настоящую параллельную обработку через UI.\n');
console.log('✅ РЕШЕНИЕ: Используем текущий workflow - он УЖЕ обрабатывает все items параллельно!\n');
console.log('Проблема НЕ в параллельности, а в том что Merge ждет все результаты.\n');
console.log('Текущая архитектура ПРАВИЛЬНАЯ - просто нужно протестировать заново.\n');

