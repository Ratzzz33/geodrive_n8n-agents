/**
 * Проверка данных доставки для Batumi
 * Диагностика отсутствия цен на доставку в агенте поиска
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBatumiData() {
  console.log('🔍 Проверка данных доставки для Batumi\n');
  console.log('='.repeat(70));
  
  // 1. Проверяем филиалы
  console.log('\n1️⃣  ФИЛИАЛЫ:');
  const branches = await sql`
    SELECT id, code, name FROM branches ORDER BY code
  `;
  
  if (branches.length === 0) {
    console.log('   ❌ КРИТИЧНО: В таблице branches НЕТ данных!');
    console.log('   Нужно создать филиалы перед импортом маршрутов.');
    return;
  }
  
  branches.forEach(b => {
    console.log(`   ✅ ${b.code.padEnd(15)} - ${b.name || 'Без названия'} (${b.id})`);
  });
  
  // 2. Проверяем города
  console.log('\n2️⃣  ГОРОДА:');
  const cities = await sql`
    SELECT id, name, primary_branch_code FROM cities ORDER BY name
  `;
  
  if (cities.length === 0) {
    console.log('   ❌ В таблице cities НЕТ данных!');
  } else {
    console.log(`   ✅ Всего городов: ${cities.length}`);
    cities.slice(0, 10).forEach(c => {
      console.log(`      - ${c.name.padEnd(20)} → ${c.primary_branch_code || 'нет филиала'}`);
    });
    if (cities.length > 10) {
      console.log(`      ... и ещё ${cities.length - 10}`);
    }
  }
  
  // 3. Проверяем тарифы доставки для Batumi
  console.log('\n3️⃣  ТАРИФЫ ДОСТАВКИ ДЛЯ BATUMI:');
  
  const batumiId = branches.find(b => b.code === 'batumi')?.id;
  
  if (!batumiId) {
    console.log('   ❌ Филиал "batumi" не найден в таблице branches!');
  } else {
    const batumiPricing = await sql`
      SELECT 
        city_name,
        delivery_branch_code,
        delivery_scope,
        intercity_fee_usd,
        return_fee_usd,
        one_way_allowed
      FROM city_delivery_pricing
      WHERE delivery_branch_code = 'batumi'
      ORDER BY city_name, delivery_scope
    `;
    
    if (batumiPricing.length === 0) {
      console.log('   ❌ НЕТ тарифов для target_branch_code = "batumi"');
      console.log('   Это ПРИЧИНА проблемы: VIEW не может найти цены.');
    } else {
      console.log(`   ✅ Найдено ${batumiPricing.length} тарифов:`);
      batumiPricing.forEach(p => {
        console.log(`      - ${p.city_name.padEnd(20)} | ${p.delivery_scope.padEnd(10)} | ${p.intercity_fee_usd}$ доставка, ${p.return_fee_usd}$ возврат`);
      });
    }
  }
  
  // 4. Проверяем VIEW для Batumi
  console.log('\n4️⃣  CAR_DELIVERY_OPTIONS_VIEW для Batumi:');
  
  const viewData = await sql`
    SELECT 
      car_id, 
      car_plate, 
      current_branch_code, 
      target_branch_code,
      delivery_scope,
      final_delivery_fee_usd, 
      final_one_way_fee_usd
    FROM car_delivery_options_view
    WHERE target_branch_code = 'batumi'
    LIMIT 10
  `;
  
  if (viewData.length === 0) {
    console.log('   ❌ VIEW не возвращает записей для target_branch_code = "batumi"');
    console.log('   Это подтверждает проблему: нет тарифов → нет данных в VIEW.');
  } else {
    console.log(`   ✅ VIEW возвращает ${viewData.length} записей (показаны первые 10):`);
    viewData.forEach(v => {
      console.log(`      - ${v.car_plate?.padEnd(10) || 'N/A'.padEnd(10)} | ${v.current_branch_code?.padEnd(10) || 'N/A'.padEnd(10)} → ${v.target_branch_code || 'N/A'} | ${v.delivery_scope || 'N/A'} | ${v.final_delivery_fee_usd}$`);
    });
  }
  
  // 5. Рекомендации
  console.log('\n5️⃣  РЕКОМЕНДАЦИИ:');
  
  const hasBatumiPricing = batumiId && batumiPricing && batumiPricing.length > 0;
  
  if (!hasBatumiPricing) {
    console.log('   📝 Нужно добавить тарифы доставки ДЛЯ филиала Batumi.');
    console.log('   Проверьте файл excel/routes.xlsx:');
    console.log('      - Должны быть строки с "Филиал (RU)" = "batumi" или "Batumi"');
    console.log('      - Цены доставки из других городов В Batumi');
    console.log('');
    console.log('   Если данных нет, добавьте их вручную или через SQL:');
    console.log('   ```sql');
    console.log('   INSERT INTO city_delivery_pricing (');
    console.log('     city_id, city_name, delivery_branch_id, delivery_branch_code,');
    console.log('     delivery_scope, intercity_fee_usd, return_fee_usd, one_way_allowed');
    console.log('   ) VALUES (');
    console.log('     (SELECT id FROM cities WHERE name = \'Тбилиси\'),');
    console.log('     \'Тбилиси\',');
    console.log(`     '${batumiId}',`);
    console.log('     \'batumi\',');
    console.log('     \'intercity\',');
    console.log('     50.00, -- цена доставки Тбилиси → Batumi');
    console.log('     50.00, -- цена возврата');
    console.log('     TRUE');
    console.log('   );');
    console.log('   ```');
    console.log('');
    console.log('   После добавления данных запустите снова:');
    console.log('   node setup/check_batumi_delivery_data.mjs');
  } else {
    console.log('   ✅ Тарифы для Batumi найдены!');
    console.log('   Агент должен корректно показывать цены.');
  }
  
  console.log('\n' + '='.repeat(70));
}

async function main() {
  try {
    await checkBatumiData();
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

