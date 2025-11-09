import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixConstraint() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Исправляем constraint на таблице history...\n');

    // 1. Удаляем старый constraint
    console.log('1️⃣ Удаляем старый constraint: history_branch_operation_unique');
    await sql`ALTER TABLE history DROP CONSTRAINT IF EXISTS history_branch_operation_unique CASCADE;`;
    console.log('   ✅ Удалён\n');

    // 2. Создаём новый UNIQUE INDEX на (branch, operation_id)
    console.log('2️⃣ Создаём новый UNIQUE INDEX: history_branch_operation_id_unique');
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS history_branch_operation_id_unique
        ON history (branch, operation_id)
        WHERE operation_id IS NOT NULL;
    `;
    console.log('   ✅ Создан\n');

    // 3. Создаём индекс для быстрого поиска
    console.log('3️⃣ Создаём индекс для operation_id');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_history_operation_id 
        ON history (operation_id)
        WHERE operation_id IS NOT NULL;
    `;
    console.log('   ✅ Создан\n');

    console.log('✅ Constraint исправлен!\n');
    console.log('Теперь дедупликация работает по (branch, operation_id):');
    console.log('  • operation_id всегда есть (не NULL)');
    console.log('  • operation_id уникален в RentProg');
    console.log('  • Никаких дублей!');
    console.log('');
    console.log('SQL в workflow теперь будет работать:');
    console.log('  ON CONFLICT (branch, operation_id) DO UPDATE SET ...');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixConstraint();

