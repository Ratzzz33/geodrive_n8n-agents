import fs from 'fs';

const wfPath = 'n8n-workflows/rentprog-upsert-processor-simplified.json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const respondSuccess = wf.nodes.find(n => n.name === 'Respond Success');
if (respondSuccess) {
  // Убираем JSON.stringify - используем template string
  respondSuccess.parameters.responseBody = '="{\\\"ok\\\":true,\\\"branch\\\":\\\"" & $json.branch & "\\\",\\\"entityId\\\":" & $json.data.id & "}"';
  console.log('✅ Respond Success исправлен');
}

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');
console.log('💾 Сохранено!');

