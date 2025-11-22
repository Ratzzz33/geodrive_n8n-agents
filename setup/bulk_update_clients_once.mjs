import postgres from 'postgres';
import fetch from 'node-fetch';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MzY1NTQ0NSwiZXhwIjoxNzY2MjQ3NDQ1LCJqdGkiOiI4YjFhMzg4NS1lYTJkLTRmMjQtOWIwNC04MTE0YzNkODc4MWYifQ.FmwUZv_gW0NMQ4vAmRjIMKk24yT0LE4HdQASDnfGaNk';

async function bulkUpdateOnce() {
  console.log('📡 Загружаем ВСЕХ клиентов из RentProg API (один запрос)...\n');
  
  // Запрашиваем все 10000 клиентов за раз
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
  const allClients = (data.data || []);
  
  console.log(`✅ Получено клиентов: ${allClients.length}\n`);
  
  // Обрабатываем и дедуплицируем
  const clientsWithPhone = allClients
    .map(c => {
      const attrs = c.attributes || c;
      const phone = attrs.phone ? String(attrs.phone).replace(/[^0-9+]/g, '') : null;
      return phone && attrs.id ? { rentprog_id: String(attrs.id), phone } : null;
    })
    .filter(Boolean);
  
  console.log(`📞 Клиентов с phone: ${clientsWithPhone.length}`);
  
  // Дедуплицируем по phone (один rentprog_id на phone)
  const uniqueClients = new Map();
  clientsWithPhone.forEach(c => {
    uniqueClients.set(c.phone, c.rentprog_id);
  });
  
  const dedupedClients = Array.from(uniqueClients.entries()).map(([phone, rentprog_id]) => ({
    phone,
    rentprog_id
  }));
  
  console.log(`🔄 После дедупликации: ${dedupedClients.length}`);
  console.log('');
  
  // Обновляем external_refs ОДИН РАЗ
  console.log('💾 Обновляю external_refs...');
  
  try {
    const values = dedupedClients.map(c => {
      const phone = c.phone.replace(/'/g, "''");
      const rentprogId = String(c.rentprog_id).replace(/'/g, "''");
      return `('${phone}', '${rentprogId}')`;
    }).join(',\n');
    
    const result = await sql.unsafe(`
      WITH client_data AS (
        SELECT * FROM (VALUES
          ${values}
        ) AS t(phone, rentprog_id)
      ),
      matched_clients AS (
        SELECT DISTINCT ON (cd.rentprog_id)
          c.id as entity_id,
          cd.rentprog_id
        FROM client_data cd
        JOIN clients c ON c.phone = cd.phone
        ORDER BY cd.rentprog_id, c.created_at DESC
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
        mc.entity_id,
        'rentprog'::text,
        mc.rentprog_id,
        NOW(),
        NOW()
      FROM matched_clients mc
      ON CONFLICT (system, external_id)
      DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        updated_at = NOW()
      RETURNING external_id
    `);
    
    console.log(`✅ Обновлено external_refs: ${result.length}`);
    console.log('');
    
    // Финальная статистика
    const [{ count: totalRefs }] = await sql`
      SELECT COUNT(DISTINCT external_id) as count
      FROM external_refs
      WHERE system = 'rentprog' AND entity_type = 'client'
    `;
    
    console.log('📊 Финальная статистика:');
    console.log(`   🔑 Уникальных rentprog_id в БД: ${totalRefs}`);
    console.log(`   📞 Клиентов RentProg с phone: ${clientsWithPhone.length}`);
    console.log(`   📈 Покрытие: ${Math.round(totalRefs / clientsWithPhone.length * 100)}%`);
    
  } catch (error) {
    console.error('❌ Ошибка SQL:', error.message);
  }
  
  await sql.end();
  console.log('');
  console.log('🎉 Готово!');
}

bulkUpdateOnce().catch(console.error);

