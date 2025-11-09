#!/usr/bin/env node
/**
 * Инструмент для AI Agent: получение курсов валют из БД
 * 
 * Использование:
 * node query_exchange_rates.mjs <branch> [date]
 * 
 * Примеры:
 * node query_exchange_rates.mjs tbilisi
 * node query_exchange_rates.mjs tbilisi 2025-11-08
 * node query_exchange_rates.mjs all
 */

import postgres from 'postgres';
import 'dotenv/config';

const CONNECTION_STRING = process.env.POSTGRES_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function queryExchangeRates() {
  try {
    const args = process.argv.slice(2);
    const branch = args[0] || 'tbilisi';
    const date = args[1] || null;
    
    let query;
    let results;
    
    if (branch === 'all') {
      // Все филиалы, последние курсы
      query = sql`
        SELECT DISTINCT ON (branch)
          branch,
          gel_to_usd,
          gel_to_eur,
          gel_to_rub,
          usd_to_gel,
          eur_to_gel,
          rub_to_gel,
          ts
        FROM exchange_rates
        ORDER BY branch, ts DESC
      `;
      results = await query;
      
    } else if (date) {
      // Конкретный филиал и дата
      query = sql`
        SELECT 
          branch,
          gel_to_usd,
          gel_to_eur,
          gel_to_rub,
          usd_to_gel,
          eur_to_gel,
          rub_to_gel,
          ts
        FROM exchange_rates
        WHERE branch = ${branch}
          AND DATE(ts) = ${date}
        ORDER BY ts DESC
        LIMIT 1
      `;
      results = await query;
      
    } else {
      // Конкретный филиал, последний курс
      query = sql`
        SELECT 
          branch,
          gel_to_usd,
          gel_to_eur,
          gel_to_rub,
          usd_to_gel,
          eur_to_gel,
          rub_to_gel,
          ts
        FROM exchange_rates
        WHERE branch = ${branch}
        ORDER BY ts DESC
        LIMIT 1
      `;
      results = await query;
    }
    
    if (results.length === 0) {
      console.log(JSON.stringify({
        ok: false,
        error: `No exchange rates found for branch "${branch}"${date ? ` on ${date}` : ''}`,
        branch,
        date
      }));
      return;
    }
    
    // Форматируем результат
    const output = {
      ok: true,
      count: results.length,
      rates: results.map(r => ({
        branch: r.branch,
        gel_to_usd: parseFloat(r.gel_to_usd),
        gel_to_eur: parseFloat(r.gel_to_eur),
        gel_to_rub: parseFloat(r.gel_to_rub),
        usd_to_gel: parseFloat(r.usd_to_gel),
        eur_to_gel: parseFloat(r.eur_to_gel),
        rub_to_gel: parseFloat(r.rub_to_gel),
        timestamp: r.ts
      }))
    };
    
    console.log(JSON.stringify(output, null, 2));
    
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      error: error.message
    }));
  } finally {
    await sql.end();
  }
}

queryExchangeRates();

