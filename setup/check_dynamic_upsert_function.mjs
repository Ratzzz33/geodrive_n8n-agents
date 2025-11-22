import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkDynamicUpsertFunction() {
  console.log('🔍 Детальный анализ функции dynamic_upsert_entity...\n');
  
  try {
    // 1. Получаем определение функции
    console.log('1️⃣ Получаю определение функции...\n');
    const functionDef = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'dynamic_upsert_entity'
        AND pronargs = 3
      ORDER BY oid DESC
      LIMIT 1
    `;
    
    if (functionDef.length === 0) {
      console.log('❌ Функция не найдена!');
      return;
    }
    
    const def = functionDef[0].definition;
    console.log('✅ Функция найдена\n');
    
    // 2. Ищем ON CONFLICT в функции
    console.log('2️⃣ Анализ ON CONFLICT в функции...\n');
    
    const conflictMatches = def.match(/ON CONFLICT[^;]+/gi);
    if (conflictMatches) {
      conflictMatches.forEach((match, idx) => {
        console.log(`   ON CONFLICT #${idx + 1}:`);
        console.log(`   ${match.substring(0, 200)}...`);
      });
    } else {
      console.log('   ⚠️  ON CONFLICT не найден в функции');
    }
    
    // 3. Проверяем структуру таблицы cars
    console.log('\n3️⃣ Проверка структуры таблицы cars...\n');
    
    const primaryKey = await sql`
      SELECT 
        constraint_name,
        constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'cars'::regclass
        AND constraint_type = 'p'
    `;
    
    if (primaryKey.length > 0) {
      console.log(`   ✅ PRIMARY KEY найден:`);
      console.log(`   ${primaryKey[0].definition}`);
    } else {
      console.log(`   ❌ PRIMARY KEY НЕ найден!`);
    }
    
    // 4. Проверяем уникальные индексы на id
    console.log('\n4️⃣ Проверка уникальных индексов на id...\n');
    
    const uniqueIndexes = await sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'cars'
        AND indexdef LIKE '%id%'
        AND indexdef LIKE '%UNIQUE%'
    `;
    
    console.log(`   Найдено уникальных индексов на id: ${uniqueIndexes.length}`);
    uniqueIndexes.forEach(idx => {
      console.log(`   - ${idx.indexname}: ${idx.indexdef}`);
    });
    
    // 5. Тестируем функцию с реальными данными
    console.log('\n5️⃣ Тестирование функции с реальными данными...\n');
    
    const testData = {
      rentprog_id: '59772',
      car_name: 'Audi Q7',
      code: 'Audi Q7 950',
      number: 'XX950DX',
      vin: 'WA1LHAF75JD045715',
      color: 'White',
      year: 2018
    };
    
    try {
      console.log('   Вызываю функцию...');
      const result = await sql`
        SELECT * FROM dynamic_upsert_entity(
          'cars'::TEXT,
          ${testData.rentprog_id}::TEXT,
          ${JSON.stringify(testData)}::JSONB
        )
      `;
      
      console.log(`   ✅ Функция выполнилась успешно`);
      console.log(`   Результат: ${JSON.stringify(result[0])}`);
    } catch (error) {
      console.log(`   ❌ ОШИБКА при вызове функции:`);
      console.log(`   ${error.message}`);
      console.log(`   Stack: ${error.stack?.substring(0, 500)}...`);
      
      // Проверяем, какая именно ошибка
      if (error.message.includes('ON CONFLICT')) {
        console.log(`\n   🔴 ПРОБЛЕМА: Ошибка ON CONFLICT в самой функции!`);
        console.log(`   Это означает, что проблема в определении функции, а не в вызове`);
      }
    }
    
    // 6. Проверяем, что функция делает с external_refs
    console.log('\n6️⃣ Проверка логики работы с external_refs...\n');
    
    if (def.includes('external_refs')) {
      console.log('   ✅ Функция использует external_refs');
      
      // Ищем, как функция ищет entity_id
      const externalRefsMatch = def.match(/SELECT.*entity_id.*FROM external_refs[^;]+/i);
      if (externalRefsMatch) {
        console.log(`   Запрос к external_refs:`);
        console.log(`   ${externalRefsMatch[0].substring(0, 300)}...`);
      }
    } else {
      console.log('   ⚠️  Функция НЕ использует external_refs - может быть проблема!');
    }
    
    // 7. Ищем проблему в INSERT
    console.log('\n7️⃣ Анализ INSERT в функции...\n');
    
    const insertMatches = def.match(/INSERT INTO[^;]+/gi);
    if (insertMatches) {
      insertMatches.forEach((match, idx) => {
        console.log(`   INSERT #${idx + 1}:`);
        console.log(`   ${match.substring(0, 300)}...`);
        
        // Проверяем, есть ли ON CONFLICT
        if (match.includes('ON CONFLICT')) {
          console.log(`   ⚠️  Этот INSERT использует ON CONFLICT`);
          
          // Извлекаем, что указано в ON CONFLICT
          const conflictPart = match.match(/ON CONFLICT[^)]+\)/i);
          if (conflictPart) {
            console.log(`   ON CONFLICT часть: ${conflictPart[0]}`);
            
            // Проверяем, что указано в скобках
            const conflictColumns = conflictPart[0].match(/\(([^)]+)\)/);
            if (conflictColumns) {
              const columns = conflictColumns[1];
              console.log(`   Колонки в ON CONFLICT: ${columns}`);
              
              // Проверяем, есть ли уникальный индекс на эти колонки
              if (columns.includes('id')) {
                console.log(`   ✅ Использует ON CONFLICT (id)`);
                console.log(`   Проверяю, есть ли уникальный индекс на id...`);
                
                const idIndex = await sql`
                  SELECT indexname, indexdef
                  FROM pg_indexes
                  WHERE tablename = 'cars'
                    AND indexdef LIKE '%id%'
                    AND (indexdef LIKE '%UNIQUE%' OR indexdef LIKE '%PRIMARY%')
                `;
                
                if (idIndex.length > 0) {
                  console.log(`   ✅ Уникальный индекс на id найден:`);
                  idIndex.forEach(idx => {
                    console.log(`      - ${idx.indexname}`);
                  });
                } else {
                  console.log(`   ❌ Уникальный индекс на id НЕ найден!`);
                  console.log(`   🔴 ВОТ ПРОБЛЕМА!`);
                }
              }
            }
          }
        }
      });
    }
    
    console.log('\n✅ Анализ завершен!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await sql.end();
  }
}

checkDynamicUpsertFunction()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
