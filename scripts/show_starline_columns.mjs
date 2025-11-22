import postgres from 'postgres';

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const rows = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'starline_devices'
      ORDER BY ordinal_position
    `;

    console.log('Колонки starline_devices:');
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.column_name}`);
    });
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main();


