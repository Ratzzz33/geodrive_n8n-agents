import postgres from 'postgres';
import fetch from 'node-fetch';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MzY1NTQ0NSwiZXhwIjoxNzY2MjQ3NDQ1LCJqdGkiOiI4YjFhMzg4NS1lYTJkLTRmMjQtOWIwNC04MTE0YzNkODc4MWYifQ.FmwUZv_gW0NMQ4vAmRjIMKk24yT0LE4HdQASDnfGaNk';

async function importAllClients() {
  console.log('📡 Загружаем ВСЕХ клиентов из RentProg API...\n');
  
  // Получаем всех клиентов за один запрос
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
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  console.log('💾 Импортирую клиентов в БД...\n');
  
  // Обрабатываем порциями по 100
  const batchSize = 100;
  for (let i = 0; i < allClients.length; i += batchSize) {
    const batch = allClients.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allClients.length / batchSize);
    
    process.stdout.write(`\r📦 Batch ${batchNum}/${totalBatches}...`);
    
    for (const client of batch) {
      const attrs = client.attributes || client;
      const rentprogId = String(attrs.id);
      
      // Пропускаем если нет основных данных
      if (!rentprogId) {
        skipped++;
        continue;
      }
      
      const phone = attrs.phone ? String(attrs.phone).replace(/[^0-9+]/g, '') : null;
      const email = attrs.email && String(attrs.email).includes('@') ? String(attrs.email).trim().toLowerCase() : null;
      const firstName = attrs.first_name || attrs.name || '';
      const lastName = attrs.last_name || attrs.lastname || '';
      const middleName = attrs.middle_name || attrs.middlename || '';
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || `Client ${rentprogId}`;
      
      try {
        // Upsert в clients
        const result = await sql`
          INSERT INTO clients (
            phone,
            email,
            name,
            lastname,
            middlename,
            fio,
            category,
            entity,
            entity_name,
            country,
            city,
            address,
            birthday,
            passport_series,
            passport_number,
            passport_issued,
            driver_series,
            driver_number,
            driver_issued,
            balance,
            debt,
            debtor,
            problems,
            source,
            notes,
            telegram_username,
            whatsapp,
            rentprog_id,
            data,
            created_at,
            updated_at
          )
          VALUES (
            ${phone},
            ${email},
            ${firstName || null},
            ${lastName || null},
            ${middleName || null},
            ${fullName},
            ${attrs.category || 'Новый'},
            ${attrs.entity || false},
            ${attrs.entity_name || null},
            ${attrs.country || null},
            ${attrs.city || null},
            ${attrs.address || null},
            ${attrs.birthday || null},
            ${attrs.passport_series || null},
            ${attrs.passport_number || null},
            ${attrs.passport_issued || null},
            ${attrs.driver_series || null},
            ${attrs.driver_number || null},
            ${attrs.driver_issued || null},
            ${attrs.balance || 0},
            ${attrs.debt || 0},
            ${attrs.debtor || false},
            ${attrs.problems || false},
            ${attrs.source || null},
            ${attrs.notes || null},
            ${attrs.telegram || null},
            ${attrs.whatsapp || null},
            ${rentprogId},
            ${sql.json(attrs)},
            ${attrs.created_at || new Date().toISOString()},
            NOW()
          )
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
          RETURNING 
            id,
            (xmax = 0) as is_new
        `;
        
        if (result[0]?.is_new) {
          created++;
        } else {
          updated++;
        }
        
        // Создаём external_refs
        await sql`
          INSERT INTO external_refs (
            entity_type,
            entity_id,
            system,
            external_id,
            created_at,
            updated_at
          )
          VALUES (
            'client',
            ${result[0].id},
            'rentprog',
            ${rentprogId},
            NOW(),
            NOW()
          )
          ON CONFLICT (system, external_id)
          DO UPDATE SET
            entity_id = EXCLUDED.entity_id,
            updated_at = NOW()
        `;
        
      } catch (error) {
        // Пропускаем ошибки (например, дубликаты)
        skipped++;
      }
    }
  }
  
  console.log('\n');
  console.log('🎉 Импорт завершен!\n');
  console.log('📊 Статистика:');
  console.log(`   ✅ Создано новых: ${created}`);
  console.log(`   🔄 Обновлено: ${updated}`);
  console.log(`   ⏭️  Пропущено: ${skipped}`);
  console.log(`   📦 Всего обработано: ${created + updated + skipped}`);
  
  // Финальная проверка
  const [{ total }] = await sql`SELECT COUNT(*) as total FROM clients`;
  const [{ with_id }] = await sql`SELECT COUNT(*) as with_id FROM clients WHERE rentprog_id IS NOT NULL`;
  
  console.log('');
  console.log('📊 Финальная статистика БД:');
  console.log(`   👥 Всего клиентов: ${total}`);
  console.log(`   ✅ С rentprog_id: ${with_id} (${Math.round(with_id/total*100)}%)`);
  
  await sql.end();
}

importAllClients().catch(console.error);

