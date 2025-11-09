import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📋 Филиалы в БД:\n');
  
  const branches = await sql`
    SELECT id, code, name 
    FROM branches 
    ORDER BY id
  `;
  
  branches.forEach(b => {
    console.log(`  ${b.id}: ${b.code} (${b.name})`);
  });
  
  console.log('\n🔍 company_id из payments.raw_data:\n');
  
  const companyIds = await sql`
    SELECT DISTINCT (raw_data->>'company_id')::integer as company_id, COUNT(*) as count
    FROM payments
    WHERE raw_data IS NOT NULL
      AND raw_data->>'company_id' IS NOT NULL
    GROUP BY company_id
    ORDER BY company_id
  `;
  
  companyIds.forEach(c => {
    console.log(`  ${c.company_id}: ${c.count} платежей`);
  });
  
  console.log('\n📊 Нужен маппинг company_id → branch_code');
  
} catch (err) {
  console.error('❌ Ошибка:', err);
} finally {
  await sql.end();
}
