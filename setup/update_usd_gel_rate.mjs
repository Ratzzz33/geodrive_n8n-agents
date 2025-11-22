#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function updateExchangeRate() {
  try {
    const newUsdToGel = 2.75; // Новый курс USD → GEL
    const newGelToUsd = 1 / newUsdToGel; // Обратный курс GEL → USD
    
    console.log('💰 Обновление курса доллара к лари\n');
    console.log('='.repeat(80));
    console.log(`Старый курс: USD → GEL = 2.7`);
    console.log(`Новый курс: USD → GEL = ${newUsdToGel}`);
    console.log(`Обратный курс: GEL → USD = ${newGelToUsd.toFixed(6)}`);
    console.log('='.repeat(80));
    
    // 1. Проверить текущие курсы в exchange_rates
    console.log('\n📊 1. Текущие курсы в таблице exchange_rates:');
    console.log('-'.repeat(80));
    
    const currentRates = await sql`
      SELECT 
        id,
        branch,
        usd_to_gel,
        gel_to_usd,
        created_at,
        ts
      FROM exchange_rates
      ORDER BY COALESCE(ts, created_at) DESC
      LIMIT 5
    `;
    
    if (currentRates.length === 0) {
      console.log('❌ Записей в exchange_rates не найдено');
    } else {
      console.log(`Найдено записей: ${currentRates.length}\n`);
      currentRates.forEach((rate, idx) => {
        console.log(`${idx + 1}. ID: ${rate.id}, Филиал: ${rate.branch || 'N/A'}`);
        console.log(`   USD → GEL: ${rate.usd_to_gel || 'N/A'}`);
        console.log(`   GEL → USD: ${rate.gel_to_usd || 'N/A'}`);
        console.log(`   Время: ${rate.ts || rate.created_at || 'N/A'}`);
        console.log('');
      });
    }
    
    // 2. Добавить новую запись с обновленным курсом
    console.log('\n💾 2. Добавление новой записи с обновленным курсом:');
    console.log('-'.repeat(80));
    
    const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    
    for (const branch of branches) {
      // Получаем последние курсы для филиала (если есть)
      const lastRates = await sql`
        SELECT gel_to_rub, gel_to_eur
        FROM exchange_rates
        WHERE branch = ${branch}
        ORDER BY COALESCE(ts, created_at) DESC
        LIMIT 1
      `;
      
      const gelToRub = lastRates.length > 0 ? lastRates[0].gel_to_rub : null;
      const gelToEur = lastRates.length > 0 ? lastRates[0].gel_to_eur : null;
      
      const result = await sql`
        INSERT INTO exchange_rates (
          branch,
          gel_to_rub,
          gel_to_eur,
          gel_to_usd,
          rub_to_gel,
          eur_to_gel,
          usd_to_gel,
          raw_data
        ) VALUES (
          ${branch},
          ${gelToRub},
          ${gelToEur},
          ${newGelToUsd},
          ${gelToRub ? 1 / gelToRub : null},
          ${gelToEur ? 1 / gelToEur : null},
          ${newUsdToGel},
          ${JSON.stringify({
            updated_manually: true,
            updated_at: new Date().toISOString(),
            usd_to_gel: newUsdToGel,
            gel_to_usd: newGelToUsd,
            note: 'Курс обновлен вручную с 2.7 до 2.75'
          })}
        )
        RETURNING id, branch, usd_to_gel, gel_to_usd
      `;
      
      console.log(`✅ Филиал ${branch}: добавлена запись ID ${result[0].id}`);
      console.log(`   USD → GEL: ${result[0].usd_to_gel}`);
      console.log(`   GEL → USD: ${result[0].gel_to_usd}`);
    }
    
    // 3. Обновить exchange_rate в car_prices
    console.log('\n📊 3. Обновление exchange_rate в таблице car_prices:');
    console.log('-'.repeat(80));
    
    const pricesBefore = await sql`
      SELECT COUNT(*) as count
      FROM car_prices
      WHERE exchange_rate = 2.7 OR exchange_rate IS NULL
    `;
    
    console.log(`Найдено записей для обновления: ${pricesBefore[0].count}`);
    
    if (pricesBefore[0].count > 0) {
      const updated = await sql`
        UPDATE car_prices
        SET exchange_rate = ${newUsdToGel}
        WHERE exchange_rate = 2.7 OR exchange_rate IS NULL
        RETURNING id
      `;
      
      console.log(`✅ Обновлено записей: ${updated.length}`);
    } else {
      console.log('✅ Все записи уже обновлены');
    }
    
    // 4. Проверка результата
    console.log('\n✅ 4. Проверка результата:');
    console.log('-'.repeat(80));
    
    const finalRates = await sql`
      SELECT 
        branch,
        usd_to_gel,
        gel_to_usd,
        COALESCE(ts, created_at) as time
      FROM exchange_rates
      WHERE usd_to_gel = ${newUsdToGel}
      ORDER BY COALESCE(ts, created_at) DESC
      LIMIT 10
    `;
    
    console.log(`Найдено записей с новым курсом: ${finalRates.length}`);
    finalRates.forEach((rate, idx) => {
      console.log(`${idx + 1}. ${rate.branch}: USD → GEL = ${rate.usd_to_gel}, время: ${rate.time}`);
    });
    
    const pricesAfter = await sql`
      SELECT COUNT(*) as count
      FROM car_prices
      WHERE exchange_rate = ${newUsdToGel}
    `;
    
    console.log(`\nЗаписей в car_prices с новым курсом: ${pricesAfter[0].count}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Обновление завершено');
    console.log(`\nНовый курс USD → GEL = ${newUsdToGel} применен ко всем филиалам`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

updateExchangeRate();

