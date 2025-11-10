#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

console.log('🔧 Исправление сравнения цен - правильная обработка JSONB\n');

// Обновляем функцию comparePrices в узле "Compare API vs DB"
const compareNode = workflow.nodes.find(n => n.id === 'compare-api-db');
if (compareNode) {
  // Извлекаем текущий код
  const currentCode = compareNode.parameters.jsCode;
  
  // Заменяем функцию comparePrices на улучшенную версию
  const newComparePricesFunction = `// Функция сравнения цен
const comparePrices = (apiPrices, dbPrices) => {
  // Если в API нет цен - не сравниваем
  if (!apiPrices || !Array.isArray(apiPrices) || apiPrices.length === 0) {
    return null;
  }
  
  // Если в БД нет цен - это расхождение
  if (!dbPrices || !Array.isArray(dbPrices) || dbPrices.length === 0) {
    return { type: 'missing_in_db', count: apiPrices.length, api_seasons: apiPrices.map(p => p.season_id) };
  }
  
  // Нормализуем цены из API
  const apiPriceMap = new Map();
  apiPrices.forEach(price => {
    if (price && price.season_id !== undefined && price.season_id !== null) {
      const key = String(price.season_id);
      // В API: values - это массив чисел [179, 173, 168, ...]
      const values = Array.isArray(price.values) ? price.values : [];
      apiPriceMap.set(key, {
        season_id: price.season_id,
        values: values,
        id: price.id
      });
    }
  });
  
  // Нормализуем цены из БД
  const dbPriceMap = new Map();
  dbPrices.forEach(price => {
    if (price && price.season_id !== undefined && price.season_id !== null) {
      const key = String(price.season_id);
      // В БД: price_values может быть JSONB (массив или объект)
      let values = [];
      if (price.price_values) {
        if (Array.isArray(price.price_values)) {
          // Если это массив напрямую
          values = price.price_values;
        } else if (price.price_values.values && Array.isArray(price.price_values.values)) {
          // Если это объект с полем values
          values = price.price_values.values;
        } else if (typeof price.price_values === 'string') {
          // Если это строка JSON
          try {
            const parsed = JSON.parse(price.price_values);
            values = Array.isArray(parsed) ? parsed : (parsed.values || []);
          } catch (e) {
            values = [];
          }
        }
      } else if (price.values && Array.isArray(price.values)) {
        // Fallback на values
        values = price.values;
      }
      
      dbPriceMap.set(key, {
        season_id: price.season_id,
        values: values,
        season_name: price.season_name || null
      });
    }
  });
  
  const priceDiffs = [];
  
  // Проверяем цены из API
  for (const [seasonId, apiPrice] of apiPriceMap.entries()) {
    const dbPrice = dbPriceMap.get(seasonId);
    
    if (!dbPrice) {
      priceDiffs.push({
        season_id: seasonId,
        type: 'missing_in_db',
        api_values: apiPrice.values
      });
      continue;
    }
    
    // Сравниваем значения цен (массивы чисел)
    const apiValuesStr = JSON.stringify(apiPrice.values || []);
    const dbValuesStr = JSON.stringify(dbPrice.values || []);
    
    if (apiValuesStr !== dbValuesStr) {
      priceDiffs.push({
        season_id: seasonId,
        season_name: dbPrice.season_name,
        type: 'mismatch',
        api_values: apiPrice.values,
        db_values: dbPrice.values
      });
    }
  }
  
  // Проверяем цены из БД, которых нет в API
  for (const [seasonId, dbPrice] of dbPriceMap.entries()) {
    if (!apiPriceMap.has(seasonId)) {
      priceDiffs.push({
        season_id: seasonId,
        season_name: dbPrice.season_name,
        type: 'missing_in_api',
        db_values: dbPrice.values
      });
    }
  }
  
  return priceDiffs.length > 0 ? priceDiffs : null;
};`;

  // Заменяем функцию comparePrices в коде
  const updatedCode = currentCode.replace(
    /\/\/ Функция сравнения цен[\s\S]*?return priceDiffs\.length > 0 \? priceDiffs : null;\n};/,
    newComparePricesFunction
  );

  compareNode.parameters.jsCode = updatedCode;
  console.log('✅ Обновлена функция comparePrices - правильная обработка JSONB price_values');
}

// Сохраняем
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('\n✅ Сравнение цен исправлено!');

