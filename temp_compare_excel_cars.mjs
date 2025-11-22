/**
 * Сравнение данных из Excel CSV с таблицей cars
 */

import postgres from 'postgres';
import fs from 'fs/promises';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function parseCSV(filePath) {
  const content = await fs.readFile(filePath, 'latin1'); // CSV в кодировке Windows-1251
  const lines = content.split('\n').filter(l => l.trim());
  
  console.log(`   Всего строк в файле: ${lines.length}`);
  console.log(`   Заголовок: ${lines[0].substring(0, 100)}...\n`);
  
  // Пропускаем заголовок
  const dataLines = lines.slice(1);
  
  const cars = [];
  for (const line of dataLines) {
    const fields = line.split(';');
    if (fields.length < 45) continue; // Должно быть много полей
    
    // Поля CSV:
    // 0 - Авто (полное название)
    // 1 - Марка
    // 2 - Модель
    // 3 - Номер
    // 4 - Год
    // 43 - VIN
    // 47 - Партнер (или около того)
    
    const plate = fields[3]?.trim();
    if (!plate) continue;
    
    cars.push({
      full_name: fields[0],
      brand: fields[1],
      model: fields[2],
      plate: plate,
      year: fields[4],
      vin: fields[43]?.trim() || null,
      rentprog_url: fields[40]?.trim() || null,
      partner: fields[47]?.trim() || null // Партнер из CSV
    });
  }
  
  return cars;
}

async function main() {
  try {
    console.log('\n📊 СРАВНЕНИЕ EXCEL vs БД\n');
    
    // 1. Парсим CSV
    console.log('🔍 Чтение CSV файла...\n');
    const csvCars = await parseCSV('excel/данные_по_авто_1763131843.csv');
    console.log(`✅ CSV: найдено ${csvCars.length} машин\n`);
    
    // 2. Получаем машины из БД
    console.log('🔍 Загрузка данных из БД...\n');
    const dbCars = await sql`
      SELECT 
        c.plate,
        c.model,
        c.vin,
        c.year,
        b.name as branch,
        er.external_id as rentprog_id,
        c.investor_id,
        c.data->>'investor' as investor_name_from_data
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN external_refs er ON er.entity_id = c.id AND er.entity_type = 'car' AND er.system = 'rentprog'
      ORDER BY c.plate
    `;
    console.log(`✅ БД: найдено ${dbCars.length} машин\n`);
    
    // 3. Сравнение
    console.log('📋 РАЗЛИЧИЯ:\n');
    console.log('=' .repeat(80) + '\n');
    
    // Машины в CSV, которых нет в БД
    const csvPlates = new Set(csvCars.map(c => c.plate));
    const dbPlates = new Set(dbCars.map(c => c.plate));
    
    const onlyInCSV = csvCars.filter(c => !dbPlates.has(c.plate));
    const onlyInDB = dbCars.filter(c => !csvPlates.has(c.plate));
    const inBoth = csvCars.filter(c => dbPlates.has(c.plate));
    
    console.log(`1️⃣ МАШИНЫ ТОЛЬКО В CSV (${onlyInCSV.length}):\n`);
    if (onlyInCSV.length > 0) {
      for (const car of onlyInCSV.slice(0, 10)) {
        console.log(`   ❌ ${car.plate} - ${car.brand} ${car.model}`);
      }
      if (onlyInCSV.length > 10) {
        console.log(`   ... и еще ${onlyInCSV.length - 10} машин`);
      }
    } else {
      console.log('   ✅ Нет различий\n');
    }
    
    console.log(`\n2️⃣ МАШИНЫ ТОЛЬКО В БД (${onlyInDB.length}):\n`);
    if (onlyInDB.length > 0) {
      for (const car of onlyInDB.slice(0, 10)) {
        console.log(`   ❌ ${car.plate} - ${car.model} (${car.branch})`);
      }
      if (onlyInDB.length > 10) {
        console.log(`   ... и еще ${onlyInDB.length - 10} машин`);
      }
    } else {
      console.log('   ✅ Нет различий\n');
    }
    
    console.log(`\n3️⃣ МАШИНЫ В ОБЕИХ (${inBoth.length}):\n`);
    
    // Проверяем различия в данных для машин, которые есть в обоих
    let vinDiffs = 0;
    let modelDiffs = 0;
    let yearDiffs = 0;
    let partnerInfo = 0;
    
    console.log('Проверка различий в данных...\n');
    
    for (const csvCar of inBoth) {
      const dbCar = dbCars.find(c => c.plate === csvCar.plate);
      if (!dbCar) continue;
      
      // VIN различия
      if (csvCar.vin && dbCar.vin && csvCar.vin !== dbCar.vin) {
        vinDiffs++;
        if (vinDiffs <= 5) {
          console.log(`   ⚠️  ${csvCar.plate}: VIN отличается`);
          console.log(`      CSV: ${csvCar.vin}`);
          console.log(`      БД:  ${dbCar.vin}\n`);
        }
      }
      
      // Партнер в CSV, но нет в БД
      if (csvCar.partner && csvCar.partner.trim() && !dbCar.investor_id) {
        partnerInfo++;
        if (partnerInfo <= 5) {
          console.log(`   📊 ${csvCar.plate}: В CSV указан партнер "${csvCar.partner}", в БД нет`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📈 СТАТИСТИКА:\n');
    console.log(`   CSV файл:          ${csvCars.length} машин`);
    console.log(`   База данных:       ${dbCars.length} машин`);
    console.log(`   Только в CSV:      ${onlyInCSV.length} машин`);
    console.log(`   Только в БД:       ${onlyInDB.length} машин`);
    console.log(`   Совпадают:         ${inBoth.length} машин`);
    console.log(`   Различия VIN:      ${vinDiffs}`);
    console.log(`   Партнеры из CSV:   ${partnerInfo} (есть в CSV, нет в БД)`);
    
    // Анализ партнеров из CSV
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('👥 ПАРТНЕРЫ ИЗ CSV:\n');
    
    const partnersFromCSV = new Map();
    for (const car of csvCars) {
      if (car.partner && car.partner.trim()) {
        const partner = car.partner.trim();
        if (!partnersFromCSV.has(partner)) {
          partnersFromCSV.set(partner, []);
        }
        partnersFromCSV.get(partner).push(car.plate);
      }
    }
    
    console.log(`Найдено уникальных партнеров в CSV: ${partnersFromCSV.size}\n`);
    for (const [partner, plates] of partnersFromCSV) {
      console.log(`   ${partner}: ${plates.length} машин (${plates.slice(0, 3).join(', ')}${plates.length > 3 ? '...' : ''})`);
    }
    
    // Сохраняем различия в файл
    const diff = {
      csv_total: csvCars.length,
      db_total: dbCars.length,
      only_in_csv: onlyInCSV.map(c => ({ plate: c.plate, brand: c.brand, model: c.model, partner: c.partner })),
      only_in_db: onlyInDB.map(c => ({ plate: c.plate, model: c.model, branch: c.branch })),
      vin_differences: vinDiffs,
      partners_from_csv: Array.from(partnersFromCSV.entries()).map(([name, plates]) => ({ name, cars_count: plates.length, plates }))
    };
    
    await fs.writeFile('temp_cars_comparison.json', JSON.stringify(diff, null, 2));
    console.log('\n✅ Детальное сравнение сохранено в temp_cars_comparison.json\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main();

