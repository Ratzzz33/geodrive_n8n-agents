import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkConstraints() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Проверяем constraints и indexes на таблице history...\n');

    // Проверяем UNIQUE constraints
    const constraints = await sql`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'history'::regclass
      ORDER BY conname;
    `;

    console.log('📋 CONSTRAINTS:');
    if (constraints.length === 0) {
      console.log('  ❌ Нет constraints!\n');
    } else {
      constraints.forEach(c => {
        console.log(`  ${c.conname} (${c.contype}): ${c.definition}`);
      });
      console.log('');
    }

    // Проверяем indexes
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'history'
      ORDER BY indexname;
    `;

    console.log('📋 INDEXES:');
    if (indexes.length === 0) {
      console.log('  ❌ Нет indexes!\n');
    } else {
      indexes.forEach(idx => {
        console.log(`  ${idx.indexname}`);
        console.log(`    ${idx.indexdef}`);
      });
      console.log('');
    }

    // Проверяем структуру таблицы
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'history'
      ORDER BY ordinal_position;
    `;

    console.log('📋 COLUMNS:');
    columns.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkConstraints();

