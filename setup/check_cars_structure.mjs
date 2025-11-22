#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkStructure() {
  console.log('🔍 Проверка структуры таблицы cars:\n');
  
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'cars'
    ORDER BY ordinal_position
  `;
  
  console.log('Колонки в таблице cars:');
  for (const col of columns) {
    console.log(`  - ${col.column_name} (${col.data_type}${col.is_nullable === 'YES' ? ', nullable' : ''})`);
  }
  
  console.log('\n🔍 Проверка данных машины 39736:\n');
  
  const car = await sql`
    SELECT c.*
    FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    WHERE er.entity_type = 'car' 
      AND er.system = 'rentprog' 
      AND er.external_id = '39736'
  `;
  
  if (car.length > 0) {
    console.log('Данные машины 39736:');
    console.log(JSON.stringify(car[0], null, 2));
  } else {
    console.log('❌ Машина 39736 не найдена');
  }
  
  await sql.end();
}

checkStructure().catch(console.error);

