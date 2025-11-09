import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Анализ записей с type="car.update":');
  
  const carUpdates = await sql`
    SELECT 
      id,
      ts,
      type,
      event_name,
      entity_type,
      operation,
      rentprog_id,
      company_id,
      event_hash,
      payload,
      metadata,
      execution_id,
      execution_url
    FROM events
    WHERE type = 'car.update'
    ORDER BY ts DESC
    LIMIT 1;
  `;
  
  if (carUpdates.length === 0) {
    console.log('❌ Записей с type="car.update" не найдено');
  } else {
    console.log('\n📋 Детали записи:');
    console.log(JSON.stringify(carUpdates[0], null, 2));
    
    // Проверяем источник по company_id
    const companyIds = {
      11158: 'Tbilisi',
      11157: 'Batumi',
      11162: 'Kutaisi (9360)',
      11163: 'Service Center',
      9360: 'Kutaisi (старый)',
      9506: 'Неизвестный'
    };
    
    console.log('\n🏢 Company ID:', carUpdates[0].company_id, '-', companyIds[carUpdates[0].company_id] || 'Неизвестный');
  }
  
  console.log('\n\n🔍 Проверка: есть ли активные workflows, которые пишут "car.update":');
  console.log('(Нужно проверить в N8N UI, какой workflow был активен в 12:01)');
  
} finally {
  await sql.end();
}

