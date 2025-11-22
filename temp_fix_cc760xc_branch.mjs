import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const BATUMI_ID = '627c4c88-d8a1-47bf-b9a6-2e9ad33112a4';

// Обновляем филиал
const result = await sql`
  UPDATE cars
  SET branch_id = ${BATUMI_ID}
  WHERE plate = 'CC760XC'
  RETURNING plate, model, branch_id
`;

if (result.length > 0) {
  console.log('✅ Филиал обновлён для CC760XC → Батуми');
  
  // Проверяем результат
  const check = await sql`
    SELECT 
      c.plate,
      c.model,
      b.name as branch,
      er.external_id as rentprog_id
    FROM cars c
    LEFT JOIN branches b ON b.id = c.branch_id
    LEFT JOIN external_refs er ON er.entity_id = c.id 
      AND er.entity_type = 'car' 
      AND er.system = 'rentprog'
    WHERE c.plate = 'CC760XC'
  `;
  
  console.log('\n📋 Проверка:');
  console.log(`   ${check[0].plate} - ${check[0].model}`);
  console.log(`   Филиал: ${check[0].branch}`);
  console.log(`   RentProg ID: ${check[0].rentprog_id}`);
} else {
  console.log('❌ Машина CC760XC не найдена');
}

await sql.end();

