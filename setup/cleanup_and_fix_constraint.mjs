import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function cleanupAndFix() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Очистка дублей и исправление constraint...\n');

    // 1. Удаляем старый constraint
    console.log('1️⃣ Удаляем старый constraint');
    await sql`ALTER TABLE history DROP CONSTRAINT IF EXISTS history_branch_operation_unique CASCADE;`;
    console.log('   ✅ Удалён\n');

    // 2. Находим и показываем дубли
    console.log('2️⃣ Ищем дубли по (branch, operation_id)...');
    const duplicates = await sql`
      SELECT branch, operation_id, COUNT(*) as count
      FROM history
      WHERE operation_id IS NOT NULL
      GROUP BY branch, operation_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10;
    `;
    
    if (duplicates.length === 0) {
      console.log('   ✅ Дублей нет!\n');
    } else {
      console.log(`   ⚠️  Найдено ${duplicates.length}+ групп дублей (показаны первые 10):`);
      duplicates.forEach(d => {
        console.log(`      ${d.branch} / ${d.operation_id}: ${d.count} записей`);
      });
      console.log('');

      // 3. Удаляем дубли (оставляем только последнюю запись по ts)
      console.log('3️⃣ Удаляем дубли (оставляем самую свежую запись по ts)...');
      const deleted = await sql`
        DELETE FROM history
        WHERE id IN (
          SELECT id
          FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY branch, operation_id
                     ORDER BY ts DESC
                   ) AS rn
            FROM history
            WHERE operation_id IS NOT NULL
          ) t
          WHERE rn > 1
        );
      `;
      console.log(`   ✅ Удалено ${deleted.count} дублей\n`);
    }

    // 4. Создаём новый UNIQUE INDEX
    console.log('4️⃣ Создаём новый UNIQUE INDEX: history_branch_operation_id_unique');
    await sql`
      CREATE UNIQUE INDEX history_branch_operation_id_unique
        ON history (branch, operation_id)
        WHERE operation_id IS NOT NULL;
    `;
    console.log('   ✅ Создан\n');

    // 5. Создаём индекс для быстрого поиска
    console.log('5️⃣ Создаём индекс для operation_id');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_history_operation_id 
        ON history (operation_id)
        WHERE operation_id IS NOT NULL;
    `;
    console.log('   ✅ Создан\n');

    console.log('✅ Готово!\n');
    console.log('Результат:');
    console.log('  ✅ Дубли удалены (оставлены самые свежие записи)');
    console.log('  ✅ Новый constraint: (branch, operation_id)');
    console.log('  ✅ Индекс для быстрого поиска');
    console.log('');
    console.log('Теперь workflow будет работать правильно:');
    console.log('  ON CONFLICT (branch, operation_id) DO UPDATE SET ...');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

cleanupAndFix();

