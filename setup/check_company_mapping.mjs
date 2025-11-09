import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Маппинг company_id -> branch через external_refs:\n');
  
  const mapping = await sql`
    SELECT 
      er.entity_id, 
      er.external_id, 
      b.code 
    FROM external_refs er
    JOIN branches b ON b.id = er.entity_id
    WHERE er.entity_type = 'branch' 
      AND er.system = 'rentprog'
    ORDER BY er.external_id
  `;
  
  if (mapping.length === 0) {
    console.log('  (нет маппинга в external_refs)');
    console.log('\n⚠️  Необходимо создать маппинг company_id → branch!');
    console.log('\nИспользуем известные соответствия:');
    console.log('  9247 → ? (166 платежей)');
    console.log('  9248 → ? (27 платежей)');
    console.log('  9506 → ? (94 платежей)');
    console.log('  11163 → ? (19 платежей)');
    console.log('\nДоступные филиалы:');
    console.log('  tbilisi, batumi, kutaisi, service-center');
  } else {
    mapping.forEach(m => {
      console.log(`  ${m.external_id} → ${m.code}`);
    });
  }
  
} catch (err) {
  console.error('❌ Ошибка:', err);
} finally {
  await sql.end();
}

