import fs from 'fs';

const wfFile = 'n8n-workflows/rentprog-webhooks-monitor.json';
const wf = JSON.parse(fs.readFileSync(wfFile, 'utf8'));

// Найти ноду Parse & Validate Format
const parseNode = wf.nodes.find(n => n.name === 'Parse & Validate Format');
const code = parseNode.parameters.jsCode;

// Заменить логику установки isKnownFormat
const oldPattern = `  // ========== ИТОГОВАЯ ПРОВЕРКА ==========\n  // Формат известен, если все проверки пройдены\n  if (\n    Object.keys(parsedPayload).length > 0 &&\n    rentprogId !== 'unknown' &&\n    eventType !== 'unknown' &&\n    entityType !== 'unknown' &&\n    validationErrors.length === 0\n  ) {\n    isKnownFormat = true;\n  }`;

const newPattern = `  // ========== ИТОГОВАЯ ПРОВЕРКА ==========\n  // Формат известен, если все проверки пройдены\n  // ВАЖНО: Если есть validationErrors или любое поле = 'unknown', формат НЕИЗВЕСТЕН\n  if (\n    Object.keys(parsedPayload).length > 0 &&\n    rentprogId !== 'unknown' &&\n    eventType !== 'unknown' &&\n    entityType !== 'unknown' &&\n    validationErrors.length === 0\n  ) {\n    isKnownFormat = true;\n  } else {\n    // Явно устанавливаем false для всех неизвестных форматов\n    isKnownFormat = false;\n  }`;

if (code.includes(oldPattern)) {
  parseNode.parameters.jsCode = code.replace(oldPattern, newPattern);
  fs.writeFileSync(wfFile, JSON.stringify(wf, null, 2));
  console.log('✅ Обновлена логика isKnownFormat: добавлена явная установка false');
} else {
  console.log('⚠️  Паттерн не найден, проверяю текущее состояние...');
  if (code.includes('isKnownFormat = false')) {
    console.log('✅ Явная установка false уже есть');
  } else {
    console.log('❌ Явная установка false отсутствует');
  }
}

