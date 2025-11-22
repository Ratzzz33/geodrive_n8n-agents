/**
 * ПРАВИЛЬНОЕ добавление тарифов доставки ДЛЯ Batumi
 * 
 * Логика:
 * - delivery_branch_id = филиал ОТПРАВЛЕНИЯ (где машина сейчас)
 * - city_id = город НАЗНАЧЕНИЯ (куда хочет клиент)
 * 
 * Пример: Машина в Тбилиси, клиент хочет в Батуми
 * → delivery_branch_id = tbilisi_branch.id
 * → city_id = batumi_city.id
 * → intercity_fee_usd = 50$
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Тарифы: ОТКУДА → КУДА (Batumi)
// Формат: { fromBranch, targetCity, priceUSD, etaHours }
const DELIVERY_TO_BATUMI = [
  // Из Тбилиси в Батуми
  { fromBranch: 'tbilisi', targetCity: 'Батуми', priceUSD: 50.00, etaHours: 6 },
  
  // Из Кутаиси в Батуми
  { fromBranch: 'kutaisi', targetCity: 'Батуми', priceUSD: 30.00, etaHours: 3 },
  
  // Внутри Батуми (локальная доставка)
  { fromBranch: 'batumi', targetCity: 'Батуми', priceUSD: 10.00, etaHours: 1 },
];

async function addBatumiDeliveryPricing() {
  console.log('🚚 ПРАВИЛЬНОЕ добавление тарифов доставки ДЛЯ Batumi\n');
  console.log('='.repeat(70));
  console.log('Логика: delivery_branch_id = ОТКУДА (филиал машины)');
  console.log('        city_id = КУДА (город клиента)\n');
  
  let added = 0;
  let updated = 0;
  let errors = 0;
  
  for (const route of DELIVERY_TO_BATUMI) {
    try {
      // Находим филиал ОТПРАВЛЕНИЯ (где машина)
      const [fromBranch] = await sql`
        SELECT id, code FROM branches WHERE code = ${route.fromBranch}
      `;
      
      if (!fromBranch) {
        console.log(`⚠️  Филиал "${route.fromBranch}" не найден, пропускаем`);
        continue;
      }
      
      // Находим город НАЗНАЧЕНИЯ (куда клиент хочет)
      const [targetCity] = await sql`
        SELECT id, name FROM cities 
        WHERE LOWER(name) = LOWER(${route.targetCity})
      `;
      
      if (!targetCity) {
        console.log(`⚠️  Город "${route.targetCity}" не найден, пропускаем`);
        continue;
      }
      
      // Определяем тип доставки
      const deliveryScope = route.fromBranch === 'batumi' ? 'city' : 'intercity';
      
      // Создаём/обновляем запись
      // ПРАВИЛЬНО: delivery_branch_id = откуда (fromBranch), city_id = куда (targetCity)
      const result = await sql`
        INSERT INTO city_delivery_pricing (
          city_id,
          city_name,
          delivery_branch_id,
          delivery_branch_code,
          delivery_scope,
          intercity_fee_usd,
          return_fee_usd,
          eta_hours,
          one_way_allowed,
          is_active
        ) VALUES (
          ${targetCity.id},
          ${targetCity.name},
          ${fromBranch.id},      -- ОТКУДА доставляем (филиал машины)
          ${fromBranch.code},
          ${deliveryScope},
          ${route.priceUSD},
          ${route.priceUSD},     -- return_fee = intercity_fee по умолчанию
          ${route.etaHours || null},
          TRUE,
          TRUE
        )
        ON CONFLICT (city_id, delivery_branch_id, delivery_scope) DO UPDATE SET
          intercity_fee_usd = EXCLUDED.intercity_fee_usd,
          return_fee_usd = EXCLUDED.return_fee_usd,
          eta_hours = EXCLUDED.eta_hours,
          updated_at = NOW()
        RETURNING id
      `;
      
      console.log(`✅ ${fromBranch.code.padEnd(10)} → ${targetCity.name.padEnd(15)}: ${route.priceUSD}$ (${deliveryScope})`);
      added++;
      
    } catch (error) {
      console.error(`❌ Ошибка: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n📈 Итого: ${added} тарифов добавлено/обновлено, ${errors} ошибок\n`);
  
  // Проверяем результат
  console.log('🔍 ПРОВЕРКА: тарифы для города Батуми:\n');
  
  const [batumiCity] = await sql`
    SELECT id, name FROM cities WHERE LOWER(name) = LOWER('Батуми')
  `;
  
  if (!batumiCity) {
    console.log('⚠️  Город "Батуми" не найден в таблице cities');
  } else {
    const batumiPricing = await sql`
      SELECT 
        delivery_branch_code AS from_branch,
        city_name AS to_city,
        delivery_scope,
        intercity_fee_usd,
        return_fee_usd
      FROM city_delivery_pricing
      WHERE city_id = ${batumiCity.id}
      ORDER BY delivery_branch_code, delivery_scope
    `;
    
    if (batumiPricing.length === 0) {
      console.log('⚠️  НЕТ тарифов для города Батуми');
    } else {
      console.log(`✅ Найдено ${batumiPricing.length} тарифов:`);
      batumiPricing.forEach(p => {
        console.log(`   ${p.from_branch.padEnd(10)} → ${p.to_city.padEnd(15)} | ${p.delivery_scope.padEnd(10)} | ${p.intercity_fee_usd}$`);
      });
    }
  }
  
  // Проверяем VIEW
  console.log('\n🔍 ПРОВЕРКА VIEW: car_delivery_options_view с target Batumi:\n');
  
  const viewTest = await sql`
    SELECT 
      car_id, 
      car_plate, 
      current_branch_code,
      target_branch_code,
      city_name,
      delivery_scope,
      final_delivery_fee_usd
    FROM car_delivery_options_view
    WHERE city_name = 'Батуми'
    LIMIT 5
  `;
  
  if (viewTest.length === 0) {
    console.log('⚠️  VIEW не возвращает записей для city_name = "Батуми"');
    console.log('    Возможно, нужно проверить связь таблиц или обновить VIEW.');
  } else {
    console.log(`✅ VIEW возвращает ${viewTest.length} записей (первые 5):`);
    viewTest.forEach(v => {
      console.log(`   ${v.car_plate?.padEnd(10) || 'N/A'.padEnd(10)} | ${v.current_branch_code?.padEnd(10)} → ${v.city_name} | ${v.delivery_scope} | ${v.final_delivery_fee_usd}$`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Готово! Тарифы добавлены в БД.');
  console.log('');
  console.log('Теперь проверьте агента поиска:');
  console.log('   - Запросите машины в Batumi');
  console.log('   - Агент должен показывать цены доставки');
}

async function main() {
  try {
    await addBatumiDeliveryPricing();
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

