/**
 * Добавление тарифов доставки для Batumi
 * Решение проблемы с отсутствием цен на доставку
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Тарифы доставки ДЛЯ Batumi (из других городов/филиалов)
// Формат: { cityName, fromBranch, priceUSD, etaHours }
const BATUMI_DELIVERY_PRICES = [
  // Из Тбилиси
  { cityName: 'Тбилиси', fromBranch: 'tbilisi', priceUSD: 50.00, etaHours: 6 },
  { cityName: 'Tbilisi', fromBranch: 'tbilisi', priceUSD: 50.00, etaHours: 6 },
  
  // Из Кутаиси
  { cityName: 'Кутаиси', fromBranch: 'kutaisi', priceUSD: 30.00, etaHours: 3 },
  { cityName: 'Kutaisi', fromBranch: 'kutaisi', priceUSD: 30.00, etaHours: 3 },
  
  // Внутри Батуми (местная доставка)
  { cityName: 'Батуми', fromBranch: 'batumi', priceUSD: 10.00, etaHours: 1 },
  { cityName: 'Batumi', fromBranch: 'batumi', priceUSD: 10.00, etaHours: 1 },
];

async function addBatumiPricing() {
  console.log('🚚 Добавление тарифов доставки для Batumi\n');
  console.log('='.repeat(70));
  
  // Проверяем филиал Batumi
  const [batumiBranch] = await sql`
    SELECT id, code, name FROM branches WHERE code = 'batumi'
  `;
  
  if (!batumiBranch) {
    console.error('❌ Филиал "batumi" не найден в таблице branches!');
    console.error('Создайте филиал перед импортом тарифов.');
    return;
  }
  
  console.log(`✅ Филиал Batumi найден: ${batumiBranch.id}\n`);
  
  let added = 0;
  let updated = 0;
  let errors = 0;
  
  for (const pricing of BATUMI_DELIVERY_PRICES) {
    try {
      // Находим город
      const [city] = await sql`
        SELECT id, name FROM cities 
        WHERE LOWER(name) = LOWER(${pricing.cityName})
      `;
      
      if (!city) {
        console.log(`⚠️  Город "${pricing.cityName}" не найден, пропускаем`);
        continue;
      }
      
      // Находим филиал отправления (может отличаться от Batumi)
      const [fromBranch] = await sql`
        SELECT id, code FROM branches WHERE code = ${pricing.fromBranch}
      `;
      
      if (!fromBranch) {
        console.log(`⚠️  Филиал "${pricing.fromBranch}" не найден, пропускаем`);
        continue;
      }
      
      // Определяем тип доставки
      const deliveryScope = pricing.fromBranch === 'batumi' ? 'city' : 'intercity';
      
      // Создаём/обновляем запись
      // ВАЖНО: delivery_branch_id = batumiBranch.id (целевой филиал - Batumi)
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
          one_way_allowed,
          is_active
        ) VALUES (
          ${city.id},
          ${city.name},
          ${batumiBranch.id},  -- ЦЕЛЕВОЙ филиал (Batumi)
          ${batumiBranch.code},
          ${deliveryScope},
          ${pricing.priceUSD},
          ${pricing.priceUSD}, -- return_fee = intercity_fee по умолчанию
          ${pricing.etaHours || null},
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
      
      console.log(`✅ ${city.name} (${pricing.fromBranch}) → Batumi: ${pricing.priceUSD}$ (${deliveryScope})`);
      added++;
      
    } catch (error) {
      console.error(`❌ Ошибка при добавлении тарифа: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n📈 Итого: ${added} тарифов добавлено/обновлено, ${errors} ошибок\n`);
  
  // Проверяем результат
  console.log('🔍 Проверка: тарифы для target_branch_code = "batumi":\n');
  
  const batumiPricing = await sql`
    SELECT 
      city_name,
      delivery_branch_code,
      delivery_scope,
      intercity_fee_usd,
      return_fee_usd
    FROM city_delivery_pricing
    WHERE delivery_branch_code = 'batumi'
    ORDER BY city_name, delivery_scope
  `;
  
  if (batumiPricing.length === 0) {
    console.log('⚠️  НЕТ тарифов для Batumi в БД');
  } else {
    console.log(`✅ Найдено ${batumiPricing.length} тарифов:`);
    batumiPricing.forEach(p => {
      console.log(`   - ${p.city_name.padEnd(20)} | ${p.delivery_scope.padEnd(10)} | ${p.intercity_fee_usd}$ доставка`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Готово! Теперь агент должен показывать цены на доставку.');
  console.log('');
  console.log('Для проверки запустите:');
  console.log('   node setup/check_batumi_delivery_data.mjs');
}

async function main() {
  try {
    await addBatumiPricing();
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

