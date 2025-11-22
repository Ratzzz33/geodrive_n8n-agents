import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await sql`
    SELECT data->'password' as password 
    FROM external_refs 
    WHERE system='rentprog' AND external_id='16046'
  `;
  
  if (result.length > 0) {
    console.log(result[0].password);
  } else {
    console.log('Password not found');
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}

