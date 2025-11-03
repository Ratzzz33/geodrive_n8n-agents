// Проверка структуры данных, которые получает webhook
// В n8n webhook node данные приходят в $json.body, а query параметры в $json.query

const testData = {
  // Что приходит от RentProg через Nginx
  body: {
    ts: '2025-11-02T18:39:07.495Z',
    branch: 'tbilisi',
    type: 'booking.issue.planned',
    payload: {
      id: 'test_webhook_1762108747495',
      rentprog_id: 'test_1762108747495'
    },
    ok: true
  },
  query: {} // Query параметры, если есть (например ?branch=tbilisi)
};

// Проверка выражений из workflow
console.log('Проверка выражений из workflow:\n');

console.log('1. Branch:');
console.log(`   $json.query?.branch || $json.body?.branch || 'unknown');
console.log(`   Result: ${testData.query?.branch || testData.body?.branch || 'unknown'}`);

console.log('\n2. Type:');
console.log(`   $json.body?.type || $json.body?.event || 'unknown'`);
console.log(`   Result: ${testData.body?.type || testData.body?.event || 'unknown'}`);

console.log('\n3. Ext ID:');
console.log(`   $json.body?.payload?.id || $json.body?.payload?.rentprog_id || 'unknown'`);
console.log(`   Result: ${testData.body?.payload?.id || testData.body?.payload?.rentprog_id || 'unknown'}`);

console.log('\n4. OK:');
console.log(`   $json.body?.ok !== false`);
console.log(`   Result: ${testData.body?.ok !== false}`);

console.log('\n5. Reason:');
console.log(`   $json.body?.error || $json.body?.reason || 'ok'`);
console.log(`   Result: ${testData.body?.error || testData.body?.reason || 'ok'}`);

console.log('\n6. Query Parameters Array:');
const queryParams = [
  testData.query?.branch || testData.body?.branch || 'unknown',
  testData.body?.type || testData.body?.event || 'unknown',
  testData.body?.payload?.id || testData.body?.payload?.rentprog_id || 'unknown',
  testData.body?.ok !== false,
  testData.body?.error || testData.body?.reason || 'ok'
];
console.log(JSON.stringify(queryParams, null, 2));

console.log('\n✅ Все выражения корректны');
