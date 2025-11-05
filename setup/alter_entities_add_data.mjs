import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔧 Добавляю столбцы data в сущностные таблицы...');

    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb`;
    console.log('✅ clients.data готов');

    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb`;
    console.log('✅ bookings.data готов');

    await sql`ALTER TABLE clients ALTER COLUMN updated_at SET DEFAULT NOW()`;
    await sql`ALTER TABLE bookings ALTER COLUMN updated_at SET DEFAULT NOW()`;

    console.log('🎉 Изменения применены');
  } catch (error) {
    console.error('❌ Ошибка при изменении схемы:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
