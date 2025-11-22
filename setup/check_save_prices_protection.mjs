import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkSavePricesProtection() {
  console.log('🔍 Проверка защиты от пустых значений в таблице car_prices...\n');
  
  try {
    // 1. Проверяем структуру таблицы car_prices
    console.log('1️⃣ Структура таблицы car_prices:\n');
    
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'car_prices'
      ORDER BY ordinal_position
    `;
    
    console.log('Колонки:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'YES' ? ' (nullable)' : ' (NOT NULL)'}`);
      if (col.column_default) {
        console.log(`    Default: ${col.column_default}`);
      }
    });
    
    // 2. Проверяем записи с пустыми значениями
    console.log('\n\n2️⃣ Проверка записей с пустыми значениями:\n');
    
    const emptyValues = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE car_id IS NULL) as null_car_id,
        COUNT(*) FILTER (WHERE rentprog_price_id IS NULL OR rentprog_price_id = '') as null_price_id,
        COUNT(*) FILTER (WHERE season_id IS NULL) as null_season_id,
        COUNT(*) FILTER (WHERE price_values IS NULL OR price_values::text = '{}') as null_price_values,
        COUNT(*) as total
      FROM car_prices
    `;
    
    const stats = emptyValues[0];
    console.log(`Всего записей: ${stats.total}`);
    console.log(`  NULL car_id: ${stats.null_car_id}`);
    console.log(`  NULL/пустой rentprog_price_id: ${stats.null_price_id}`);
    console.log(`  NULL season_id: ${stats.null_season_id}`);
    console.log(`  NULL/пустой price_values: ${stats.null_price_values}`);
    
    if (stats.null_car_id > 0 || stats.null_price_id > 0 || stats.null_season_id > 0 || stats.null_price_values > 0) {
      console.log('\n  ⚠️  Обнаружены записи с пустыми значениями!');
    } else {
      console.log('\n  ✅ Нет записей с пустыми значениями');
    }
    
    // 3. Проверяем последние сохраненные цены
    console.log('\n\n3️⃣ Последние сохраненные цены (за последний час):\n');
    
    const recentPrices = await sql`
      SELECT 
        id,
        car_id,
        rentprog_price_id,
        season_id,
        price_values,
        created_at
      FROM car_prices
      WHERE created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    console.log(`Найдено записей за последний час: ${recentPrices.length}`);
    
    if (recentPrices.length > 0) {
      console.log('\n  Примеры:');
      recentPrices.forEach((price, idx) => {
        console.log(`\n  ${idx + 1}. ID: ${price.id}`);
        console.log(`     car_id: ${price.car_id || 'NULL ⚠️'}`);
        console.log(`     rentprog_price_id: ${price.rentprog_price_id || 'NULL ⚠️'}`);
        console.log(`     season_id: ${price.season_id || 'NULL ⚠️'}`);
        const priceValuesStr = price.price_values ? JSON.stringify(price.price_values) : '';
        const isEmpty = !price.price_values || priceValuesStr === '{}';
        console.log(`     price_values: ${isEmpty ? 'NULL/пустой ⚠️' : 'есть'}`);
        console.log(`     created_at: ${price.created_at}`);
      });
    } else {
      console.log('  ⚠️  Нет записей за последний час');
    }
    
    // 4. Проверяем записи с проблемными значениями
    console.log('\n\n4️⃣ Записи с проблемными значениями:\n');
    
    const problematic = await sql`
      SELECT 
        id,
        car_id,
        rentprog_price_id,
        season_id,
        price_values,
        created_at
      FROM car_prices
      WHERE car_id IS NULL 
         OR rentprog_price_id IS NULL 
         OR rentprog_price_id = ''
         OR season_id IS NULL
         OR price_values IS NULL
         OR price_values::text = '{}'
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    console.log(`Найдено проблемных записей: ${problematic.length}`);
    
    if (problematic.length > 0) {
      console.log('\n  ⚠️  ПРОБЛЕМА: Обнаружены записи с пустыми значениями!');
      problematic.forEach((price, idx) => {
        console.log(`\n  ${idx + 1}. ID: ${price.id}`);
        const issues = [];
        if (!price.car_id) issues.push('car_id NULL');
        if (!price.rentprog_price_id || price.rentprog_price_id === '') issues.push('rentprog_price_id пустой');
        if (!price.season_id) issues.push('season_id NULL');
        const priceValuesStr = price.price_values ? JSON.stringify(price.price_values) : '';
        if (!price.price_values || priceValuesStr === '{}') issues.push('price_values пустой');
        console.log(`     Проблемы: ${issues.join(', ')}`);
        console.log(`     created_at: ${price.created_at}`);
      });
    } else {
      console.log('\n  ✅ Нет проблемных записей');
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await sql.end();
  }
}

checkSavePricesProtection()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });

