import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  const branches = await sql`
    SELECT id, name, rentprog_id
    FROM branches
    ORDER BY name
  `;
  
  console.log('\n📍 Филиалы в БД:\n');
  branches.forEach(b => {
    console.log(`  ${b.rentprog_id || b.name} → ${b.id}`);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

