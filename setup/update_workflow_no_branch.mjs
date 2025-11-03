import fs from 'fs';

const newCode = fs.readFileSync('setup/parse_code_no_branch.js', 'utf8');
const workflow = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-webhooks-monitor.json', 'utf8'));

// 1. Обновляем Parse & Validate Format
const parseNode = workflow.nodes.find(n => n.name === 'Parse & Validate Format');
if (parseNode) {
  parseNode.parameters.jsCode = newCode;
  console.log('✅ Parse & Validate Format: убрана логика определения branch');
  console.log('   - branch больше не определяется из query/body');
  console.log('   - добавлено поле companyId из payload.company_id');
}

// 2. Обновляем Auto Process - убираем передачу branch
const autoProcessNode = workflow.nodes.find(n => n.name === 'Auto Process');
if (autoProcessNode) {
  // Удаляем branch из bodyParameters
  autoProcessNode.parameters.bodyParameters.parameters = 
    autoProcessNode.parameters.bodyParameters.parameters.filter(p => p.name !== 'branch');
  
  // Добавляем company_id
  autoProcessNode.parameters.bodyParameters.parameters.push({
    "name": "company_id",
    "value": "={{ $json.companyId }}"
  });
  
  console.log('✅ Auto Process: обновлены параметры');
  console.log('   - убран параметр: branch');
  console.log('   - добавлен параметр: company_id');
}

// 3. Обновляем Set Query Params - убираем branch
const setParamsNode = workflow.nodes.find(n => n.name === 'Set Query Params');
if (setParamsNode) {
  // Заменяем branch на company_id
  const branchAssignment = setParamsNode.parameters.assignments.assignments.find(a => a.id === 'branch');
  if (branchAssignment) {
    branchAssignment.id = 'company_id';
    branchAssignment.name = 'company_id';
    branchAssignment.value = '={{ $json.companyId || null }}';
    branchAssignment.type = 'numberValue';
  }
  
  console.log('✅ Set Query Params: обновлены assignments');
  console.log('   - branch заменен на company_id');
}

// 4. Обновляем Save Event SQL - заменяем branch на company_id
const saveEventNode = workflow.nodes.find(n => n.name === 'Save Event');
if (saveEventNode) {
  saveEventNode.parameters.query = 
    'INSERT INTO events (ts, company_id, type, rentprog_id, ok, reason, processed)\n' +
    'VALUES (NOW(), $1, $2, $3, $4, $5, $6)\n' +
    'ON CONFLICT (company_id, type, rentprog_id) DO NOTHING\n' +
    'RETURNING id';
  
  saveEventNode.parameters.options.queryReplacement = 
    '={{ $json.company_id }},={{ $json.type }},={{ $json.rentprog_id }},={{ $json.ok }},={{ $json.reason }},={{ $json.processed }}';
  
  console.log('✅ Save Event: обновлен SQL');
  console.log('   - branch заменен на company_id в INSERT и ON CONFLICT');
}

// 5. Обновляем Debug: Unknown Format - убираем Branch из сообщения
const debugNode = workflow.nodes.find(n => n.name === 'Debug: Unknown Format');
if (debugNode) {
  debugNode.parameters.text = 
    '=<b>Неизвестный формат вебхука от RentProg</b>\n\n' +
    '<b>Тип события:</b> {{ $json.rawEvent }}\n' +
    '<b>RentProg ID:</b> {{ $json.rentprogId }}\n' +
    '<b>Company ID:</b> {{ $json.companyId || "не указан" }}\n\n' +
    '<b>Ошибки валидации:</b>\n' +
    '{{ $json.validationErrors && $json.validationErrors.length > 0 ? $json.validationErrors.join(\', \') : \'Неизвестная структура\' }}\n\n' +
    '<b>Payload (Ruby hash):</b>\n' +
    '<pre>{{ $json.body.payload }}</pre>\n\n' +
    '<b>Parsed payload (JSON):</b>\n' +
    '<pre>{{ JSON.stringify($json.parsedPayload, null, 2) }}</pre>';
  
  console.log('✅ Debug: Unknown Format: обновлено сообщение');
  console.log('   - Branch заменен на Company ID');
}

fs.writeFileSync('n8n-workflows/rentprog-webhooks-monitor.json', JSON.stringify(workflow, null, 2), 'utf8');

console.log('');
console.log('📝 Изменения:');
console.log('   ❌ Удалено: определение branch из query/body вебхука');
console.log('   ✅ Добавлено: извлечение company_id из payload');
console.log('   ✅ Создан: маппинг company_id → branch (src/config/company-branch-mapping.ts)');
console.log('');
console.log('💡 Branch теперь определяется по company_id:');
console.log('   - company_id=9248 → kutaisi');
console.log('   - company_id=11163 → service-center');

