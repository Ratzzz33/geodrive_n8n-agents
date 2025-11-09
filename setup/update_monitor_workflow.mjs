import { readFileSync } from 'fs';
import https from 'https';
import { URL } from 'url';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const OLD_WORKFLOW_ID = '1LOkRW4ROSx92SQO';
const NEW_WORKFLOW_ID = 'K9e80NPPxABA4aJy';

console.log('🗑️ Удаляем старый workflow...');

const deleteUrl = new URL(`${N8N_HOST}/workflows/${OLD_WORKFLOW_ID}`);

const deleteOptions = {
  method: 'DELETE',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY
  }
};

const deleteReq = https.request(deleteUrl, deleteOptions, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Старый workflow удален');
      
      // Активируем новый workflow
      console.log('\n🔄 Активируем новый workflow...');
      
      const activateUrl = new URL(`${N8N_HOST}/workflows/${NEW_WORKFLOW_ID}/activate`);
      const activateOptions = {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      };
      
      const activateReq = https.request(activateUrl, activateOptions, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          if (res2.statusCode === 200) {
            console.log('✅ Новый workflow активирован!');
            console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${NEW_WORKFLOW_ID}`);
          } else {
            console.error('❌ Ошибка активации:', data2);
          }
        });
      });
      
      activateReq.on('error', err => console.error('❌ Ошибка:', err.message));
      activateReq.end();
      
    } else {
      console.error('❌ Ошибка удаления:', data);
    }
  });
});

deleteReq.on('error', err => console.error('❌ Ошибка:', err.message));
deleteReq.end();

