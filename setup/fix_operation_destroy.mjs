import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔧 Исправление operation: delete → destroy...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Обновляем существующие записи с 'delete' на 'destroy'
  console.log('1️⃣ Обновление существующих записей...');
  
  const updated = await sql`
    UPDATE events 
    SET operation = 'destroy'
    WHERE operation = 'delete'
    RETURNING id;
  `;
  
  console.log(`   ✅ Обновлено записей: ${updated.length}\n`);
  
  // 2. Добавляем CHECK constraint для правильных значений
  console.log('2️⃣ Добавление CHECK constraint...');
  
  await sql.unsafe(`
    DO $$ 
    BEGIN
      -- Удаляем старый constraint если есть
      IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'events_operation_check'
      ) THEN
        ALTER TABLE events DROP CONSTRAINT events_operation_check;
      END IF;
      
      -- Добавляем новый constraint с правильными значениями
      ALTER TABLE events 
      ADD CONSTRAINT events_operation_check 
      CHECK (operation IN ('create', 'update', 'destroy') OR operation IS NULL);
    END $$;
  `);
  
  console.log('   ✅ Constraint добавлен\n');
  
  // 3. Проверяем текущее состояние
  console.log('3️⃣ Проверка operation в БД...\n');
  
  const operations = await sql`
    SELECT 
      operation,
      COUNT(*) AS count
    FROM events
    WHERE operation IS NOT NULL
    GROUP BY operation
    ORDER BY count DESC;
  `;
  
  console.log('📊 Статистика operation:');
  console.log('─────────────────────────────────────────────────');
  if (operations.length > 0) {
    operations.forEach(op => {
      console.log(`   ${op.operation?.padEnd(10)} → ${op.count} записей`);
    });
  } else {
    console.log('   (нет записей с operation)\n');
  }
  console.log('─────────────────────────────────────────────────\n');
  
  // 4. Проверяем constraint
  const constraints = await sql`
    SELECT 
      conname,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conname = 'events_operation_check';
  `;
  
  if (constraints.length > 0) {
    console.log('✅ CHECK constraint установлен:');
    console.log(`   ${constraints[0].definition}\n`);
  }
  
  console.log('✅ Исправление завершено!\n');
  console.log('💡 Теперь допустимые значения для operation:');
  console.log('   - create');
  console.log('   - update');
  console.log('   - destroy ✅ (было delete ❌)\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}


