import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const options = {
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
};

https.get(`${N8N_HOST}/workflows`, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const snapshot = json.data.find(w => w.name.includes('Cars Snapshot'));
    
    if (snapshot) {
      console.log('✅ Workflow найден:');
      console.log(`   Название: ${snapshot.name}`);
      console.log(`   ID: ${snapshot.id}`);
      console.log(`   Активен: ${snapshot.active}`);
      console.log(`   Обновлен: ${snapshot.updatedAt}`);
    } else {
      console.log('❌ Workflow "RentProg Cars Snapshot" не найден');
      console.log('📝 Доступные workflows:');
      json.data.forEach(w => console.log(`   - ${w.name} (${w.id})`));
    }
  });
}).on('error', err => {
  console.error('❌ Ошибка:', err.message);
});

