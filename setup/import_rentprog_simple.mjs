import postgres from 'postgres';
import fetch from 'node-fetch';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MzY1NTQ0NSwiZXhwIjoxNzY2MjQ3NDQ1LCJqdGkiOiI4YjFhMzg4NS1lYTJkLTRmMjQtOWIwNC04MTE0YzNkODc4MWYifQ.FmwUZv_gW0NMQ4vAmRjIMKk24yT0LE4HdQASDnfGaNk';

async function importSimple() {
  console.log('📡 Загружаем всех клиентов из RentProg...\n');
  
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
  console.log('💾 Обновляю данные в БД...\n');
  
  let created = 0;
  let updated = 0;
  
  for (let i = 0; i < allClients.length; i++) {
    const client = allClients[i];
    const attrs = client.attributes || client;
    const rentprogId = String(attrs.id);
    
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r   Обработано: ${i + 1}/${allClients.length}...`);
    }
    
    if (!rentprogId) continue;
    
    const phone = attrs.phone ? String(attrs.phone).replace(/[^0-9+]/g, '') : null;
    const email = attrs.email && String(attrs.email).includes('@') ? String(attrs.email).trim().toLowerCase() : null;
    const firstName = attrs.first_name || attrs.name || '';
    const lastName = attrs.last_name || attrs.lastname || '';
    const middleName = attrs.middle_name || attrs.middlename || '';
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || `Client ${rentprogId}`;
    
    try {
      // Проверяем есть ли клиент с таким rentprog_id
      const existing = await sql`
        SELECT id FROM clients WHERE rentprog_id = ${rentprogId}
      `;
      
      if (existing.length > 0) {
        // Обновляем существующего
        await sql`
          UPDATE clients SET
            phone = ${phone},
            email = ${email},
            name = ${firstName || null},
            lastname = ${lastName || null},
            middlename = ${middleName || null},
            fio = ${fullName},
            category = ${attrs.category || 'Новый'},
            data = ${sql.json(attrs)},
            updated_at = NOW()
          WHERE rentprog_id = ${rentprogId}
        `;
        updated++;
      } else if (phone) {
        // Создаём нового (только если есть phone)
        const result = await sql`
          INSERT INTO clients (
            phone, email, name, lastname, middlename, fio, 
            category, rentprog_id, data, created_at, updated_at
          )
          VALUES (
            ${phone}, ${email}, ${firstName || null}, ${lastName || null},
            ${middleName || null}, ${fullName}, ${attrs.category || 'Новый'},
            ${rentprogId}, ${sql.json(attrs)}, NOW(), NOW()
          )
          ON CONFLICT (phone) DO NOTHING
          RETURNING id
        `;
        if (result.length > 0) {
          created++;
          
          // Создаём external_ref
          await sql`
            INSERT INTO external_refs (
              entity_type, entity_id, system, external_id, created_at, updated_at
            )
            VALUES (
              'client', ${result[0].id}, 'rentprog', ${rentprogId}, NOW(), NOW()
            )
            ON CONFLICT (system, external_id) DO NOTHING
          `;
        }
      }
    } catch (err) {
      // Игнорируем ошибки (дубликаты phone и т.д.)
    }
  }
  
  console.log(`\n\n✅ Готово!`);
  console.log(`   🆕 Создано: ${created}`);
  console.log(`   🔄 Обновлено: ${updated}\n`);
  
  // Финальная статистика
  const [{ total }] = await sql`SELECT COUNT(*) as total FROM clients`;
  const [{ with_id }] = await sql`SELECT COUNT(*) as with_id FROM clients WHERE rentprog_id IS NOT NULL`;
  
  console.log('📊 Статистика:');
  console.log(`   👥 Всего клиентов: ${total}`);
  console.log(`   ✅ С rentprog_id: ${with_id} (${Math.round(with_id/total*100)}%)`);
  
  await sql.end();
}

importSimple().catch(console.error);

