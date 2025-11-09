/**
 * Проверка и исправление функции dynamic_upsert_entity
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkFunction() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Проверка функции dynamic_upsert_entity\n');

    // 1. Получить определение функции
    console.log('1️⃣ Определение функции:');
    const funcDef = await sql`
      SELECT 
        pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'dynamic_upsert_entity'
      AND pronamespace = 'public'::regnamespace
    `;
    
    if (funcDef.length > 0) {
      const def = funcDef[0].definition;
      
      // Ищем секцию INSERT INTO external_refs
      const hasDataParam = def.includes('INSERT INTO external_refs') && def.includes('data');
      console.log('   ✅ Функция найдена');
      console.log('   Содержит INSERT INTO external_refs:', def.includes('INSERT INTO external_refs'));
      console.log('   Содержит параметр data:', hasDataParam);
      
      // Ищем, передается ли p_data в external_refs
      const dataPattern = /INSERT INTO external_refs[\s\S]*?VALUES[\s\S]*?\([^)]+\)/i;
      const match = def.match(dataPattern);
      
      if (match) {
        console.log('\n   📝 INSERT в external_refs:');
        console.log('   ', match[0].substring(0, 200) + '...');
        
        // Проверяем, есть ли p_data в VALUES
        if (match[0].includes('p_data')) {
          console.log('\n   ✅ p_data передается в external_refs.data');
        } else {
          console.log('\n   ❌ p_data НЕ передается в external_refs.data!');
          console.log('      ЭТО ПРИЧИНА ПРОБЛЕМЫ!');
        }
      }
      
      // Показать полное определение (урезанно)
      console.log('\n   📄 Начало функции:');
      console.log('   ', def.substring(0, 500));
      
    } else {
      console.log('   ❌ Функция НЕ найдена!');
    }

  } finally {
    await sql.end();
  }
}

checkFunction().catch(console.error);

