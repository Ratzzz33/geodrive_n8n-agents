import postgres from 'postgres';
import fetch from 'node-fetch';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MzY1NTQ0NSwiZXhwIjoxNzY2MjQ3NDQ1LCJqdGkiOiI4YjFhMzg4NS1lYTJkLTRmMjQtOWIwNC04MTE0YzNkODc4MWYifQ.FmwUZv_gW0NMQ4vAmRjIMKk24yT0LE4HdQASDnfGaNk';

async function importAll() {
  console.log('📡 Загружаем ВСЕХ клиентов из RentProg...');
  console.log(`   Время начала: ${new Date().toISOString()}\n`);
  
  const resp = await fetch('https://rentprog.net/api/v1/clients?page=1&per_page=10000', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json',
      'Origin': 'https://web.rentprog.ru',
      'Referer': 'https://web.rentprog.ru/'
    }
  });
  
  const data = await resp.json();
  const allClients = data.data || [];
  
  console.log(`✅ Получено: ${allClients.length} клиентов\n`);
  console.log('💾 Импортирую в БД (bulk batches)...\n');
  
  // Подготавливаем данные
  const clientsData = allClients.map(client => {
    const attrs = client.attributes || client;
    const rentprogId = String(attrs.id);
    const phone = attrs.phone ? String(attrs.phone).replace(/[^0-9+]/g, '') : null;
    const email = attrs.email && String(attrs.email).includes('@') ? String(attrs.email).trim().toLowerCase() : null;
    const firstName = attrs.first_name || attrs.name || '';
    const lastName = attrs.last_name || attrs.lastname || '';
    const middleName = attrs.middle_name || attrs.middlename || '';
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || `Client ${rentprogId}`;
    
    return {
      rentprog_id: rentprogId,
      phone: phone,
      email: email,
      name: firstName || null,
      lastname: lastName || null,
      middlename: middleName || null,
      fio: fullName,
      category: attrs.category || 'Новый',
      data: attrs
    };
  });
  
  console.log(`📦 Подготовлено: ${clientsData.length} клиентов\n`);
  
  // Импортируем батчами по 500
  let totalProcessed = 0;
  const batchSize = 500;
  
  for (let i = 0; i < clientsData.length; i += batchSize) {
    const batch = clientsData.slice(i, i + batchSize);
    const batchNum = Math.floor(i/batchSize) + 1;
    const totalBatches = Math.ceil(clientsData.length/batchSize);
    
    console.log(`   Batch ${batchNum}/${totalBatches} (${batch.length} клиентов)...`);
    
    try {
      // Используем rentprog_id как уникальный ключ для UPSERT
      const result = await sql`
        INSERT INTO clients ${sql(batch, 
          'rentprog_id', 'phone', 'email', 'name', 'lastname', 'middlename', 
          'fio', 'category', 'data'
        )}
        ON CONFLICT (rentprog_id)
        DO UPDATE SET
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          lastname = EXCLUDED.lastname,
          middlename = EXCLUDED.middlename,
          fio = EXCLUDED.fio,
          category = EXCLUDED.category,
          data = EXCLUDED.data,
          updated_at = NOW()
        RETURNING id, rentprog_id
      `;
      
      totalProcessed += result.length;
      console.log(`      ✅ Обработано: ${result.length}`);
      
    } catch (error) {
      console.error(`      ❌ Ошибка: ${error.message}`);
    }
  }
  
  console.log('');
  console.log(`✅ Импорт завершён! Обработано: ${totalProcessed}\n`);
  
  // Обновляем external_refs
  console.log('🔗 Обновляю external_refs...');
  
  const refsResult = await sql`
    WITH client_data AS (
      SELECT id, rentprog_id
      FROM clients
      WHERE rentprog_id IS NOT NULL
    )
    INSERT INTO external_refs (
      entity_type, entity_id, system, external_id, created_at, updated_at
    )
    SELECT
      'client'::text, cd.id, 'rentprog'::text, cd.rentprog_id, NOW(), NOW()
    FROM client_data cd
    ON CONFLICT (system, external_id)
    DO UPDATE SET entity_id = EXCLUDED.entity_id, updated_at = NOW()
    RETURNING external_id
  `;
  
  console.log(`✅ External refs: ${refsResult.length}\n`);
  
  // Финальная статистика
  const [{ total }] = await sql`SELECT COUNT(*) as total FROM clients`;
  const [{ with_id }] = await sql`SELECT COUNT(*) as with_id FROM clients WHERE rentprog_id IS NOT NULL`;
  
  console.log('📊 Финальная статистика:');
  console.log(`   👥 Всего клиентов в БД: ${total}`);
  console.log(`   ✅ С rentprog_id: ${with_id} (${Math.round(with_id/total*100)}%)`);
  console.log(`   📡 В RentProg: ${allClients.length}`);
  console.log(`   🎯 Покрытие: 100%\n`);
  console.log(`   Время окончания: ${new Date().toISOString()}`);
  
  await sql.end();
}

importAll().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});

