import postgres from 'postgres';
import fetch from 'node-fetch';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MzY1NTQ0NSwiZXhwIjoxNzY2MjQ3NDQ1LCJqdGkiOiI4YjFhMzg4NS1lYTJkLTRmMjQtOWIwNC04MTE0YzNkODc4MWYifQ.FmwUZv_gW0NMQ4vAmRjIMKk24yT0LE4HdQASDnfGaNk';

async function importAllClientsFast() {
  console.log('📡 Загружаем ВСЕХ клиентов из RentProg API...\n');
  
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
  
  console.log(`✅ Получено клиентов: ${allClients.length}\n`);
  
  // Подготавливаем данные для bulk insert
  console.log('🔄 Подготавливаю данные...');
  
  const clientsData = allClients
    .map(client => {
      const attrs = client.attributes || client;
      const rentprogId = String(attrs.id);
      
      if (!rentprogId) return null;
      
      const phone = attrs.phone ? String(attrs.phone).replace(/[^0-9+]/g, '') : null;
      if (!phone) return null; // Пропускаем клиентов без phone
      
      const email = attrs.email && String(attrs.email).includes('@') ? String(attrs.email).trim().toLowerCase() : null;
      const firstName = attrs.first_name || attrs.name || '';
      const lastName = attrs.last_name || attrs.lastname || '';
      const middleName = attrs.middle_name || attrs.middlename || '';
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || `Client ${rentprogId}`;
      
      return {
        phone,
        email,
        name: firstName || null,
        lastname: lastName || null,
        middlename: middleName || null,
        fio: fullName,
        category: attrs.category || 'Новый',
        entity: attrs.entity || false,
        entity_name: attrs.entity_name || null,
        country: attrs.country || null,
        city: attrs.city || null,
        address: attrs.address || null,
        birthday: attrs.birthday || null,
        passport_series: attrs.passport_series || null,
        passport_number: attrs.passport_number || null,
        passport_issued: attrs.passport_issued || null,
        driver_series: attrs.driver_series || null,
        driver_number: attrs.driver_number || null,
        driver_issued: attrs.driver_issued || null,
        balance: Math.round(parseFloat(attrs.balance) || 0),
        debt: Math.round(parseFloat(attrs.debt) || 0),
        debtor: attrs.debtor || false,
        problems: attrs.problems || false,
        source: attrs.source || null,
        notes: attrs.notes || null,
        telegram_username: attrs.telegram || null,
        whatsapp: attrs.whatsapp || null,
        rentprog_id: rentprogId,
        data: attrs,
        created_at: attrs.created_at || new Date().toISOString()
      };
    })
    .filter(Boolean);
  
  console.log(`✅ Подготовлено: ${clientsData.length} клиентов (с phone)\n`);
  
  // Bulk insert через INSERT ... ON CONFLICT (по батчам)
  console.log('💾 Импортирую в БД (батчами по 500)...');
  
  let totalProcessed = 0;
  const batchSize = 500;
  
  try {
    for (let i = 0; i < clientsData.length; i += batchSize) {
      const batch = clientsData.slice(i, i + batchSize);
      process.stdout.write(`\r   Batch ${Math.floor(i/batchSize)+1}/${Math.ceil(clientsData.length/batchSize)}...`);
      
      const result = await sql`
        INSERT INTO clients ${sql(batch, 
        'phone', 'email', 'name', 'lastname', 'middlename', 'fio',
        'category', 'entity', 'entity_name', 'country', 'city', 'address',
        'birthday', 'passport_series', 'passport_number', 'passport_issued',
        'driver_series', 'driver_number', 'driver_issued', 
        'balance', 'debt', 'debtor', 'problems', 'source', 'notes',
        'telegram_username', 'whatsapp', 'rentprog_id', 'data', 'created_at'
      )}
      ON CONFLICT (phone)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        lastname = EXCLUDED.lastname,
        middlename = EXCLUDED.middlename,
        fio = EXCLUDED.fio,
        category = EXCLUDED.category,
        entity = EXCLUDED.entity,
        entity_name = EXCLUDED.entity_name,
        country = EXCLUDED.country,
        city = EXCLUDED.city,
        address = EXCLUDED.address,
        birthday = EXCLUDED.birthday,
        passport_series = EXCLUDED.passport_series,
        passport_number = EXCLUDED.passport_number,
        passport_issued = EXCLUDED.passport_issued,
        driver_series = EXCLUDED.driver_series,
        driver_number = EXCLUDED.driver_number,
        driver_issued = EXCLUDED.driver_issued,
        balance = EXCLUDED.balance,
        debt = EXCLUDED.debt,
        debtor = EXCLUDED.debtor,
        problems = EXCLUDED.problems,
        source = EXCLUDED.source,
        notes = EXCLUDED.notes,
        telegram_username = EXCLUDED.telegram_username,
        whatsapp = EXCLUDED.whatsapp,
        rentprog_id = EXCLUDED.rentprog_id,
        data = EXCLUDED.data,
        updated_at = NOW()
        RETURNING id, rentprog_id
      `;
      
      totalProcessed += result.length;
    }
    
    console.log(`\n   ✅ Обработано: ${totalProcessed} клиентов\n`);
    
    // Обновляем external_refs одним запросом
    console.log('🔗 Обновляю external_refs...');
    
    const externalRefsResult = await sql`
      WITH client_data AS (
        SELECT id, rentprog_id
        FROM clients
        WHERE rentprog_id IS NOT NULL
      )
      INSERT INTO external_refs (
        entity_type,
        entity_id,
        system,
        external_id,
        created_at,
        updated_at
      )
      SELECT
        'client'::text,
        cd.id,
        'rentprog'::text,
        cd.rentprog_id,
        NOW(),
        NOW()
      FROM client_data cd
      ON CONFLICT (system, external_id)
      DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        updated_at = NOW()
      RETURNING external_id
    `;
    
    console.log(`✅ Обновлено external_refs: ${externalRefsResult.length}\n`);
    
    // Финальная статистика
    const [{ total }] = await sql`SELECT COUNT(*) as total FROM clients`;
    const [{ with_id }] = await sql`SELECT COUNT(*) as with_id FROM clients WHERE rentprog_id IS NOT NULL`;
    
    console.log('🎉 Импорт завершен!\n');
    console.log('📊 Финальная статистика:');
    console.log(`   👥 Всего клиентов в БД: ${total}`);
    console.log(`   ✅ С rentprog_id: ${with_id} (${Math.round(with_id/total*100)}%)`);
    console.log(`   📡 В RentProg: ${allClients.length}`);
    console.log(`   🔗 Покрытие: ${Math.round(with_id/allClients.length*100)}%`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  }
  
  await sql.end();
}

importAllClientsFast().catch(console.error);

