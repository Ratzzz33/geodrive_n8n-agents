#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkData() {
  try {
    console.log('🔍 Проверка данных по ценам автомобилей...\n');
    
    // 1. Общее количество записей в car_prices
    const pricesCount = await sql`SELECT COUNT(*) as count FROM car_prices`;
    console.log(`📊 Записей в car_prices: ${pricesCount[0].count}`);
    
    // 2. Записи по филиалам (через связь с cars)
    const byBranch = await sql`
      SELECT 
        b.name as branch,
        COUNT(DISTINCT cp.car_id) as cars_with_prices
      FROM branches b
      LEFT JOIN cars c ON c.branch_id = b.id
      LEFT JOIN car_prices cp ON cp.car_id = c.id
      GROUP BY b.id, b.name
      ORDER BY b.name
    `;
    
    console.log('\n📍 По филиалам:');
    byBranch.forEach(row => {
      console.log(`   ${row.branch}: ${row.cars_with_prices} авто с ценами`);
    });
    
    // 3. Последние записи
    const latest = await sql`
      SELECT 
        cp.created_at,
        cp.season_name,
        c.reg_number
      FROM car_prices cp
      JOIN cars c ON c.id = cp.car_id
      ORDER BY cp.created_at DESC
      LIMIT 5
    `;
    
    if (latest.length > 0) {
      console.log('\n🕐 Последние добавленные цены:');
      latest.forEach(row => {
        console.log(`   ${row.created_at.toISOString()} - ${row.reg_number} (${row.season_name})`);
      });
    }
    
    // 4. Проверка таблицы car_price_checks
    const checksCount = await sql`SELECT COUNT(*) as count FROM car_price_checks`;
    console.log(`\n✅ Проверок выполнено: ${checksCount[0].count}`);
    
    if (checksCount[0].count > 0) {
      const recentChecks = await sql`
        SELECT 
          branch_code,
          COUNT(*) as total,
          SUM(CASE WHEN has_prices THEN 1 ELSE 0 END) as with_prices,
          SUM(CASE WHEN NOT has_prices THEN 1 ELSE 0 END) as without_prices,
          MAX(checked_at) as last_check
        FROM car_price_checks
        GROUP BY branch_code
        ORDER BY branch_code
      `;
      
      console.log('\n📋 Результаты проверок:');
      recentChecks.forEach(row => {
        console.log(`   ${row.branch_code}: ${row.with_prices}/${row.total} с ценами (последняя проверка: ${row.last_check.toISOString()})`);
      });
    }
    
    console.log('\n✅ Проверка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkData();

