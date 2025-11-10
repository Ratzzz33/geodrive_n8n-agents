#!/usr/bin/env node
/**
 * Проверка состояний (state) автомобилей в БД
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Проверка состояний (state) автомобилей в БД\n');
  
  // 1. Сгруппировать по state из data
  const stateGroups = await sql`
    SELECT 
      data->>'state' as state,
      COUNT(*) as count,
      array_agg(plate) FILTER (WHERE plate IS NOT NULL) as examples
    FROM cars 
    WHERE data IS NOT NULL 
      AND data->>'state' IS NOT NULL
    GROUP BY data->>'state'
    ORDER BY count DESC
  `;
  
  console.log('📊 Статусы (state) из БД:');
  console.log('='.repeat(60));
  
  stateGroups.forEach(row => {
    const examples = row.examples ? row.examples.slice(0, 3).join(', ') : 'N/A';
    console.log(`State ${row.state}: ${row.count} машин`);
    console.log(`   Примеры: ${examples}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  // 2. Всего машин
  const total = await sql`SELECT COUNT(*) as count FROM cars`;
  console.log(`\nВсего машин в БД: ${total[0].count}`);
  
  // 3. Машины без state
  const noState = await sql`
    SELECT COUNT(*) as count FROM cars 
    WHERE data IS NULL OR data->>'state' IS NULL
  `;
  console.log(`Машин без state: ${noState[0].count}`);
  
  await sql.end();
}

main().catch(console.error);

