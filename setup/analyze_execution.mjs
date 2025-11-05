import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const executionId = process.argv[2] || '315';

console.log(`🔍 Анализ execution #${executionId}...\n`);

const options = {
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
};

https.get(`${N8N_HOST}/executions/${executionId}?includeData=true`, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const exec = json.data;
      
      console.log(`📊 Execution #${exec.id}`);
      console.log(`   Status: ${exec.finished ? '✅ Success' : '❌ Error'}`);
      console.log(`   Started: ${new Date(exec.startedAt).toLocaleString('ru-RU')}`);
      console.log(`   Stopped: ${new Date(exec.stoppedAt).toLocaleString('ru-RU')}`);
      console.log(`   Duration: ${Math.round((new Date(exec.stoppedAt) - new Date(exec.startedAt)) / 1000)}s\n`);
      
      if (exec.data && exec.data.resultData) {
        const runs = exec.data.resultData.runData || {};
        const nodeNames = Object.keys(runs);
        
        console.log(`📝 Выполненные ноды (${nodeNames.length}):\n`);
        
        nodeNames.forEach(nodeName => {
          const nodeRuns = runs[nodeName];
          const lastRun = nodeRuns[nodeRuns.length - 1];
          const dataLength = lastRun?.data?.main?.[0]?.length || 0;
          
          console.log(`   • ${nodeName}`);
          console.log(`     Запусков: ${nodeRuns.length}`);
          console.log(`     Элементов: ${dataLength}`);
          
          // Показываем первый элемент данных если есть
          if (dataLength > 0 && lastRun.data.main[0][0]) {
            const item = lastRun.data.main[0][0].json;
            
            // Для Parse & Validate Format показываем isKnownFormat
            if (nodeName === 'Parse & Validate Format') {
              console.log(`     isKnownFormat: ${item.isKnownFormat}`);
              console.log(`     eventType: ${item.eventType}`);
              console.log(`     entityType: ${item.entityType}`);
              if (item.validationErrors && item.validationErrors.length > 0) {
                console.log(`     ⚠️  Ошибки: ${item.validationErrors.join(', ')}`);
              }
            }
            
            // Для If Known Format показываем путь
            if (nodeName === 'If Known Format') {
              console.log(`     Путь: ${item.isKnownFormat === true ? 'Known (true path)' : 'Unknown (false path)'}`);
            }
            
            // Для Telegram показываем был ли отправлен
            if (nodeName.includes('Telegram') || nodeName.includes('Debug')) {
              console.log(`     ✉️  Telegram вызван`);
              if (item.message_id) {
                console.log(`     ✅ Сообщение отправлено (ID: ${item.message_id})`);
              }
            }
          }
          console.log('');
        });
        
        // Проверяем была ли вызвана Telegram нода
        const telegramNodes = nodeNames.filter(n => 
          n.includes('Telegram') || 
          n.includes('Debug') || 
          n.includes('Unknown') ||
          n.includes('Alert')
        );
        
        if (telegramNodes.length === 0) {
          console.log('⚠️  ПРОБЛЕМА: Telegram нода НЕ была вызвана!');
          console.log('   Это означает что вебхук не попал в путь "Unknown format"\n');
        } else {
          console.log(`✅ Telegram ноды вызваны: ${telegramNodes.join(', ')}\n`);
        }
        
        // Проверяем If Known Format
        if (runs['If Known Format']) {
          const ifNode = runs['If Known Format'][0];
          const item = ifNode?.data?.main?.[0]?.[0]?.json;
          if (item) {
            console.log(`🔀 If Known Format:`);
            console.log(`   isKnownFormat = ${item.isKnownFormat}`);
            console.log(`   Должен идти в: ${item.isKnownFormat === true ? 'Auto Process' : 'Debug: Unknown Format'}\n`);
          }
        }
        
      } else {
        console.log('❌ Нет данных выполнения');
      }
      
    } catch (e) {
      console.error('❌ Ошибка:', e.message);
      console.log('Ответ (первые 500 символов):', data.substring(0, 500));
    }
  });
}).on('error', err => {
  console.error('❌ Ошибка запроса:', err.message);
});

