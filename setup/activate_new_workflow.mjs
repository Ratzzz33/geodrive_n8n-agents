import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const NEW_WF_ID = 'fijJpRlLjgpxSJE7';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}${path}`);
    const bodyStr = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function main() {
  console.log(`🔄 Активация workflow ${NEW_WF_ID}...\n`);

  const activated = await request('PATCH', `/workflows/${NEW_WF_ID}`, { active: true });
  console.log(`✅ Активирован!\n`);

  console.log('═'.repeat(70));
  console.log('\n✅ Fixed workflow активирован!');
  console.log(`\n📌 Workflow: ${activated.name}`);
  console.log(`   ID: ${NEW_WF_ID}`);
  console.log(`   Активен: ${activated.active}`);
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/${NEW_WF_ID}`);
  console.log(`   Webhook: https://n8n.rentflow.rentals/webhook/upsert-processor`);
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
});

