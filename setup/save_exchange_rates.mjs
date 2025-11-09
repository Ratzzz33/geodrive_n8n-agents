#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Курсы валют (спаршенные вручную 2025-11-09)
const rates = {
  gel_to_rub: 31.88,
  gel_to_eur: 0.3175,
  gel_to_usd: 0.3704,
  rub_to_gel: 1 / 31.88,
  eur_to_gel: 1 / 0.3175,
  usd_to_gel: 1 / 0.3704
};

try {
  console.log('💰 Сохраняю курсы валют в БД...\n');
  console.log('Курсы:');
  console.log(`  GEL → RUB: ${rates.gel_to_rub}`);
  console.log(`  GEL → EUR: ${rates.gel_to_eur}`);
  console.log(`  GEL → USD: ${rates.gel_to_usd}`);
  console.log(`  RUB → GEL: ${rates.rub_to_gel.toFixed(4)}`);
  console.log(`  EUR → GEL: ${rates.eur_to_gel.toFixed(4)}`);
  console.log(`  USD → GEL: ${rates.usd_to_gel.toFixed(4)}`);
  console.log();
  
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
      'tbilisi',
      ${rates.gel_to_rub},
      ${rates.gel_to_eur},
      ${rates.gel_to_usd},
      ${rates.rub_to_gel},
      ${rates.eur_to_gel},
      ${rates.usd_to_gel},
      ${JSON.stringify({
        parsed_at: new Date().toISOString(),
        parsed_manually: true,
        rates: rates
      })}
    )
    RETURNING id, created_at
  `;
  
  console.log('✅ Курсы сохранены!');
  console.log(`   ID: ${result[0].id}`);
  console.log(`   Время: ${result[0].created_at}`);
  
} catch (error) {
  console.error('❌ Ошибка:', error);
  process.exit(1);
} finally {
  await sql.end();
}

