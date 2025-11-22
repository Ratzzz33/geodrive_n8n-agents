/**
 * Проверка каждой ноды execution #18249
 * Анализ данных по нодам из API
 */

// Данные из execution #18249
const executionData = {
  "Normalize Cars": {
    itemsInput: 0,
    itemsOutput: 124,
    status: "success"
  },
  "Save Snapshot": {
    itemsInput: 0,
    itemsOutput: 124,
    status: "success"
  },
  "Save Cars": {
    itemsInput: 0,
    itemsOutput: 124,
    status: "success"
  }
};

console.log('🔍 Проверка каждой ноды execution #18249...\n');
console.log('='.repeat(80));
console.log('АНАЛИЗ НОД');
console.log('='.repeat(80));
console.log();

// 1. Normalize Cars
console.log('📊 1. НОДА: Normalize Cars');
console.log('-'.repeat(80));
console.log(`✅ Статус: ${executionData["Normalize Cars"].status}`);
console.log(`📥 Входных items: ${executionData["Normalize Cars"].itemsInput}`);
console.log(`📤 Выходных items: ${executionData["Normalize Cars"].itemsOutput}`);
console.log(`✅ Все ${executionData["Normalize Cars"].itemsOutput} машин обработаны`);
console.log();

// 2. Save Snapshot
console.log('📊 2. НОДА: Save Snapshot');
console.log('-'.repeat(80));
console.log(`✅ Статус: ${executionData["Save Snapshot"].status}`);
console.log(`📥 Входных items: ${executionData["Save Snapshot"].itemsInput}`);
console.log(`📤 Выходных items: ${executionData["Save Snapshot"].itemsOutput}`);
if (executionData["Save Snapshot"].itemsOutput === executionData["Normalize Cars"].itemsOutput) {
  console.log(`✅ Все ${executionData["Save Snapshot"].itemsOutput} машин сохранены в snapshot`);
} else {
  console.log(`❌ ПРОБЛЕМА: Ожидалось ${executionData["Normalize Cars"].itemsOutput}, получено ${executionData["Save Snapshot"].itemsOutput}`);
}
console.log();

// 3. Save Cars
console.log('📊 3. НОДА: Save Cars');
console.log('-'.repeat(80));
console.log(`✅ Статус: ${executionData["Save Cars"].status}`);
console.log(`📥 Входных items: ${executionData["Save Cars"].itemsInput}`);
console.log(`📤 Выходных items: ${executionData["Save Cars"].itemsOutput}`);
if (executionData["Save Cars"].itemsOutput === executionData["Normalize Cars"].itemsOutput) {
  console.log(`✅ Все ${executionData["Save Cars"].itemsOutput} машин сохранены в cars`);
} else {
  console.log(`❌ ПРОБЛЕМА: Ожидалось ${executionData["Normalize Cars"].itemsOutput}, получено ${executionData["Save Cars"].itemsOutput}`);
}
console.log();

// Итоговый отчет
console.log('='.repeat(80));
console.log('📊 ИТОГОВЫЙ ОТЧЕТ ПО НОДАМ');
console.log('='.repeat(80));
console.log(`Всего машин на входе (Normalize Cars): ${executionData["Normalize Cars"].itemsOutput}`);
console.log(`Сохранено в snapshot: ${executionData["Save Snapshot"].itemsOutput}`);
console.log(`Сохранено в cars: ${executionData["Save Cars"].itemsOutput}`);

const allSuccess = 
  executionData["Normalize Cars"].status === "success" &&
  executionData["Save Snapshot"].status === "success" &&
  executionData["Save Cars"].status === "success" &&
  executionData["Save Snapshot"].itemsOutput === executionData["Normalize Cars"].itemsOutput &&
  executionData["Save Cars"].itemsOutput === executionData["Normalize Cars"].itemsOutput;

if (allSuccess) {
  console.log('\n✅ ВСЕ НОДЫ ВЫПОЛНЕНЫ УСПЕШНО!');
  console.log('✅ Все данные прошли через workflow без потерь');
} else {
  console.log('\n⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ - см. детали выше');
}

