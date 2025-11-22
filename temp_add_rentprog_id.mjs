import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const [car] = await sql`SELECT id FROM cars WHERE plate = 'TT780TR'`;
if (car) {
  await sql`INSERT INTO external_refs (entity_type, entity_id, system, external_id) VALUES ('car', ${car.id}, 'rentprog', '54504')`;
  console.log('✅ RentProg ID добавлен для TT780TR');
}

await sql.end();

