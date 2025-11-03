// Тест генерации queryParameters для Save Event ноды
const testWebhook = {
  headers: {},
  params: {},
  query: {},
  body: {
    ts: "2025-11-02T19:05:02.808Z",
    branch: "tbilisi",
    type: "booking.issue.planned",
    payload: {
      id: "testwebhook1762110302809",
      rentprogid: "test1762110302809"
    },
    ok: true
  }
};

// Симуляция n8n expressions
const $json = testWebhook;
const $now = new Date().toISOString();

// Выражение из Save Event ноды
const branch = $json.query && $json.query.branch ? $json.query.branch : ($json.body && $json.body.branch ? $json.body.branch : 'unknown');
const type = $json.body && $json.body.type ? $json.body.type : ($json.body && $json.body.event ? $json.body.event : 'unknown');
const ext_id = $json.body && $json.body.payload && $json.body.payload.id ? $json.body.payload.id : ($json.body && $json.body.payload && ($json.body.payload.rentprog_id || $json.body.payload.rentprogid) ? ($json.body.payload.rentprog_id || $json.body.payload.rentprogid) : 'unknown');
const ok = $json.body && $json.body.ok !== false;
const reason = $json.body && $json.body.error ? $json.body.error : ($json.body && $json.body.reason ? $json.body.reason : 'ok');

const queryParameters = [branch, type, ext_id, ok, reason];

console.log('📊 Генерируемые queryParameters:');
console.log(JSON.stringify(queryParameters, null, 2));
console.log('\nПараметры:');
console.log(`  Branch: ${branch} (${typeof branch})`);
console.log(`  Type: ${type} (${typeof type})`);
console.log(`  Ext ID: ${ext_id} (${typeof ext_id})`);
console.log(`  OK: ${ok} (${typeof ok})`);
console.log(`  Reason: ${reason} (${typeof reason})`);

// Проверка SQL запроса
console.log('\n📝 SQL запрос будет:');
console.log(`INSERT INTO events (ts, branch, type, ext_id, ok, reason, processed)`);
console.log(`VALUES (NOW(), $1, $2, $3, $4, $5, FALSE)`);
console.log(`ON CONFLICT (branch, type, ext_id) DO NOTHING`);
console.log(`RETURNING id`);
console.log('\nС параметрами:', queryParameters);

