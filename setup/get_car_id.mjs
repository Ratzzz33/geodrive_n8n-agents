import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await sql`
    SELECT rentprog_id FROM cars LIMIT 1
  `;
  
  if (result.length > 0) {
    console.log('ID машины:', result[0].rentprog_id);
  } else {
    console.log('Нет машин в БД');
  }
} finally {
  await sql.end();
}

