/**
 * Импорт данных о городах и маршрутах доставки из Excel
 * Файлы: excel/cities.xlsx и excel/routes.xlsx
 */

import XLSX from 'xlsx';
import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Маппинг русских названий филиалов на коды
const BRANCH_NAME_TO_CODE = {
  'тбилиси': 'tbilisi',
  'tbilisi': 'tbilisi',
  'батуми': 'batumi',
  'batumi': 'batumi',
  'кутаиси': 'kutaisi',
  'kutaisi': 'kutaisi',
  'service-center': 'service-center',
  'сервис': 'service-center'
};

async function getBranchId(nameOrCode) {
  if (!nameOrCode) return null;
  
  const normalized = nameOrCode.toLowerCase().trim();
  const branchCode = BRANCH_NAME_TO_CODE[normalized] || normalized;
  
  const [branch] = await sql`
    SELECT id, code FROM branches WHERE code = ${branchCode}
  `;
  
  return branch?.id || null;
}

async function importCities() {
  console.log('\n📊 Импорт городов из cities.xlsx...\n');
  
  const filePath = join(__dirname, '..', 'excel', 'cities.xlsx');
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`   Найдено ${data.length} городов в файле`);
    
    let imported = 0;
    let updated = 0;
    let errors = 0;
    
    for (const row of data) {
      try {
        // Структура из Excel: "Название (RU)", "Название (EN)", "Привязка к филиалу"
        const cityNameRU = (row['Название (RU)'] || row.name || row.city || '').trim();
        const cityNameEN = (row['Название (EN)'] || row.name_en || '').trim();
        const primaryBranchName = (row['Привязка к филиалу'] || row.primary_branch || row.branch || '').trim();
        
        // Используем русское название как основное
        const cityName = cityNameRU || cityNameEN;
        const primaryBranchCode = primaryBranchName;
        const nearestBranchCode = primaryBranchCode; // По умолчанию = primary
        const hasAirport = false; // Пока нет данных об аэропортах
        const airportName = null;
        
        if (!cityName) {
          console.log(`   ⚠️  Пропущена строка без названия города`);
          continue;
        }
        
        const primaryBranchId = await getBranchId(primaryBranchCode);
        const nearestBranchId = await getBranchId(nearestBranchCode) || primaryBranchId;
        
        // Вставляем или обновляем город
        const result = await sql`
          INSERT INTO cities (
            name,
            primary_branch_id,
            primary_branch_code,
            nearest_branch_id,
            nearest_branch_code,
            has_airport,
            airport_name,
            is_active
          ) VALUES (
            ${cityName},
            ${primaryBranchId},
            ${primaryBranchCode || null},
            ${nearestBranchId},
            ${nearestBranchCode || primaryBranchCode || null},
            ${hasAirport || false},
            ${airportName || null},
            TRUE
          )
          ON CONFLICT (name) DO UPDATE SET
            primary_branch_id = EXCLUDED.primary_branch_id,
            primary_branch_code = EXCLUDED.primary_branch_code,
            nearest_branch_id = EXCLUDED.nearest_branch_id,
            nearest_branch_code = EXCLUDED.nearest_branch_code,
            has_airport = EXCLUDED.has_airport,
            airport_name = EXCLUDED.airport_name,
            updated_at = NOW()
          RETURNING id, name
        `;
        
        if (result.length > 0) {
          if (result[0].id) {
            console.log(`   ✅ ${cityName} - ${primaryBranchCode || 'без филиала'}`);
            imported++;
          } else {
            updated++;
          }
        }
      } catch (error) {
        console.error(`   ❌ Ошибка при импорте города: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n   📈 Итого: ${imported} импортировано, ${updated} обновлено, ${errors} ошибок`);
    
  } catch (error) {
    console.error(`\n   ❌ Ошибка при чтении файла cities.xlsx: ${error.message}`);
    throw error;
  }
}

async function importRoutes() {
  console.log('\n📊 Импорт маршрутов из routes.xlsx...\n');
  
  const filePath = join(__dirname, '..', 'excel', 'routes.xlsx');
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`   Найдено ${data.length} маршрутов в файле`);
    
    let imported = 0;
    let updated = 0;
    let errors = 0;
    
    for (const row of data) {
      try {
        // Структура из Excel: "Город (RU)", "Филиал (RU)", "Цена"
        const cityName = (row['Город (RU)'] || row.city || '').trim();
        const branchName = (row['Филиал (RU)'] || row.from_branch || '').trim();
        const priceUsd = parseFloat(row['Цена'] || row.price_usd || row.price || 0);
        
        // Если цена 0, пропускаем (это тот же филиал)
        if (priceUsd === 0) {
          continue;
        }
        
        const fromBranchCode = branchName;
        const toBranchCode = branchName; // В файле только один филиал
        const etaHours = null; // Нет данных о времени
        
        if (!cityName || !fromBranchCode || !toBranchCode || !priceUsd) {
          console.log(`   ⚠️  Пропущен маршрут: неполные данные`);
          continue;
        }
        
        // Находим город
        const [city] = await sql`
          SELECT id, name FROM cities WHERE LOWER(name) = LOWER(${cityName})
        `;
        
        if (!city) {
          console.log(`   ⚠️  Город "${cityName}" не найден в таблице cities, пропускаем`);
          continue;
        }
        
        const deliveryBranchId = await getBranchId(fromBranchCode);
        
        if (!deliveryBranchId) {
          console.log(`   ⚠️  Филиал "${fromBranchCode}" не найден, пропускаем`);
          continue;
        }
        
        // Создаём записи для трёх типов доставки:
        // 1. Внутри города (city) - 10$
        // 2. До аэропорта (airport) - 20$
        // 3. Между городами (intercity) - цена из файла
        
        // 1. Доставка внутри города
        await sql`
          INSERT INTO city_delivery_pricing (
            city_id,
            city_name,
            delivery_branch_id,
            delivery_branch_code,
            delivery_scope,
            intercity_fee_usd,
            return_fee_usd,
            eta_hours,
            one_way_allowed
          ) VALUES (
            ${city.id},
            ${city.name},
            ${deliveryBranchId},
            ${fromBranchCode},
            'city',
            ${10.00}, -- in_city_fee_usd
            ${10.00}, -- return_fee_usd
            ${etaHours || null},
            TRUE
          )
          ON CONFLICT (city_id, delivery_branch_id, delivery_scope) DO UPDATE SET
            intercity_fee_usd = EXCLUDED.intercity_fee_usd,
            return_fee_usd = EXCLUDED.return_fee_usd,
            eta_hours = EXCLUDED.eta_hours,
            updated_at = NOW()
        `;
        
        // 2. Доставка до аэропорта (если у города есть аэропорт)
        const [cityData] = await sql`
          SELECT has_airport FROM cities WHERE id = ${city.id}
        `;
        
        if (cityData?.has_airport) {
          await sql`
            INSERT INTO city_delivery_pricing (
              city_id,
              city_name,
              delivery_branch_id,
              delivery_branch_code,
              delivery_scope,
              intercity_fee_usd,
              return_fee_usd,
              eta_hours,
              one_way_allowed
            ) VALUES (
              ${city.id},
              ${city.name},
              ${deliveryBranchId},
              ${fromBranchCode},
              'airport',
              ${20.00}, -- airport_fee_usd
              ${20.00}, -- return_fee_usd
              ${etaHours || null},
              TRUE
            )
            ON CONFLICT (city_id, delivery_branch_id, delivery_scope) DO UPDATE SET
              intercity_fee_usd = EXCLUDED.intercity_fee_usd,
              return_fee_usd = EXCLUDED.return_fee_usd,
              eta_hours = EXCLUDED.eta_hours,
              updated_at = NOW()
          `;
        }
        
        // 3. Доставка между городами (intercity)
        await sql`
          INSERT INTO city_delivery_pricing (
            city_id,
            city_name,
            delivery_branch_id,
            delivery_branch_code,
            delivery_scope,
            intercity_fee_usd,
            return_fee_usd,
            eta_hours,
            one_way_allowed
          ) VALUES (
            ${city.id},
            ${city.name},
            ${deliveryBranchId},
            ${fromBranchCode},
            'intercity',
            ${priceUsd},
            ${priceUsd}, -- return_fee_usd по умолчанию равен intercity_fee_usd
            ${etaHours || null},
            TRUE
          )
          ON CONFLICT (city_id, delivery_branch_id, delivery_scope) DO UPDATE SET
            intercity_fee_usd = EXCLUDED.intercity_fee_usd,
            return_fee_usd = EXCLUDED.return_fee_usd,
            eta_hours = EXCLUDED.eta_hours,
            updated_at = NOW()
        `;
        
        console.log(`   ✅ ${cityName} (${fromBranchCode} → ${toBranchCode}): ${priceUsd}$`);
        imported++;
        
      } catch (error) {
        console.error(`   ❌ Ошибка при импорте маршрута: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n   📈 Итого: ${imported} маршрутов импортировано, ${errors} ошибок`);
    
  } catch (error) {
    console.error(`\n   ❌ Ошибка при чтении файла routes.xlsx: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Импорт данных о городах и маршрутах доставки\n');
    console.log('='.repeat(60));
    
    await importCities();
    await importRoutes();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Импорт завершён успешно!');
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

