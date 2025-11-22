import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCarsConstraints() {
  console.log('🔍 Проверка ограничений таблицы cars...\n');
  
  try {
    // 1. Проверяем уникальные индексы
    console.log('1️⃣ Уникальные индексы на rentprog_id:\n');
    const uniqueIndexes = await sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'cars'
        AND indexdef LIKE '%rentprog_id%'
        AND indexdef LIKE '%UNIQUE%'
    `;
    
    console.log(`   Найдено уникальных индексов: ${uniqueIndexes.length}`);
    uniqueIndexes.forEach(idx => {
      console.log(`   - ${idx.indexname}: ${idx.indexdef}`);
    });
    
    // 2. Проверяем UNIQUE constraints
    console.log('\n2️⃣ UNIQUE constraints на rentprog_id:\n');
    const uniqueConstraints = await sql`
      SELECT 
        conname,
        contype,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'cars'::regclass
        AND contype IN ('u', 'p')
        AND pg_get_constraintdef(oid) LIKE '%rentprog_id%'
    `;
    
    console.log(`   Найдено UNIQUE constraints: ${uniqueConstraints.length}`);
    uniqueConstraints.forEach(con => {
      console.log(`   - ${con.conname} (${con.contype}): ${con.definition}`);
    });
    
    // 3. Проверяем, можно ли использовать ON CONFLICT
    console.log('\n3️⃣ Проверка возможности использования ON CONFLICT:\n');
    
    // Частичный индекс (с WHERE) не может использоваться в ON CONFLICT
    const partialIndexes = uniqueIndexes.filter(idx => idx.indexdef.includes('WHERE'));
    if (partialIndexes.length > 0) {
      console.log(`   ⚠️  Найдено ${partialIndexes.length} частичных индексов (с WHERE):`);
      partialIndexes.forEach(idx => {
        console.log(`      - ${idx.indexname}: НЕ может использоваться в ON CONFLICT`);
      });
    }
    
    // Полноценные UNIQUE constraints или индексы без WHERE
    const fullIndexes = uniqueIndexes.filter(idx => !idx.indexdef.includes('WHERE'));
    if (fullIndexes.length > 0) {
      console.log(`   ✅ Найдено ${fullIndexes.length} полноценных индексов (без WHERE):`);
      fullIndexes.forEach(idx => {
        console.log(`      - ${idx.indexname}: МОЖЕТ использоваться в ON CONFLICT`);
      });
    }
    
    if (uniqueConstraints.length > 0) {
      console.log(`   ✅ Найдено ${uniqueConstraints.length} UNIQUE constraints:`);
      uniqueConstraints.forEach(con => {
        console.log(`      - ${con.conname}: МОЖЕТ использоваться в ON CONFLICT`);
      });
    }
    
    // 4. Проверяем структуру таблицы
    console.log('\n4️⃣ Структура таблицы cars (rentprog_id):\n');
    const rentprogIdColumn = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'cars'
        AND column_name = 'rentprog_id'
    `;
    
    if (rentprogIdColumn.length > 0) {
      const col = rentprogIdColumn[0];
      console.log(`   Тип: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default || 'нет'}`);
    }
    
    // 5. Итоговый вывод
    console.log('\n5️⃣ ИТОГОВЫЙ ВЫВОД:\n');
    
    if (fullIndexes.length === 0 && uniqueConstraints.length === 0) {
      console.log('   ❌ ПРОБЛЕМА: Нет полноценного UNIQUE индекса или constraint на rentprog_id!');
      console.log('   ⚠️  Частичный индекс (с WHERE) не может использоваться в ON CONFLICT');
      console.log('   ✅ РЕШЕНИЕ: Создать полноценный UNIQUE constraint на rentprog_id');
    } else {
      console.log('   ✅ Есть полноценный UNIQUE индекс или constraint');
      console.log('   ⚠️  Но возможно проблема в другом месте SQL запроса');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

checkCarsConstraints()
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
