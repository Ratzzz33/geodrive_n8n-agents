import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkClient() {
  try {
    console.log('\n🔍 Проверка клиента ID 381296 в БД...\n');
    
    // 1. Проверка в external_refs
    console.log('1️⃣ Проверка в external_refs...');
    const ref = await sql`
      SELECT 
        id,
        entity_type,
        entity_id,
        system,
        external_id,
        branch_code,
        meta,
        created_at,
        updated_at
      FROM external_refs
      WHERE system = 'rentprog' AND external_id = '381296'
      LIMIT 1
    `;
    
    if (ref.length > 0) {
      console.log('   ✅ НАЙДЕН в external_refs:');
      console.log('      ID:', ref[0].id);
      console.log('      Entity Type:', ref[0].entity_type);
      console.log('      Entity ID:', ref[0].entity_id);
      console.log('      System:', ref[0].system);
      console.log('      External ID:', ref[0].external_id);
      console.log('      Branch Code:', ref[0].branch_code);
      console.log('      Created:', ref[0].created_at.toISOString());
      console.log('      Updated:', ref[0].updated_at.toISOString());
      console.log('      Meta:', JSON.stringify(ref[0].meta, null, 2));
      
      // 2. Проверка в clients
      console.log('\n2️⃣ Проверка в clients...');
      const client = await sql`
        SELECT 
          id,
          name,
          phone,
          email,
          data,
          created_at,
          updated_at
        FROM clients
        WHERE id = ${ref[0].entity_id}
        LIMIT 1
      `;
      
      if (client.length > 0) {
        console.log('   ✅ НАЙДЕН в clients:');
        console.log('      ID:', client[0].id);
        console.log('      Name:', client[0].name);
        console.log('      Phone:', client[0].phone);
        console.log('      Email:', client[0].email);
        console.log('      Created:', client[0].created_at.toISOString());
        console.log('      Updated:', client[0].updated_at.toISOString());
        if (client[0].data) {
          console.log('      Data:', JSON.stringify(client[0].data, null, 2));
        }
      } else {
        console.log('   ❌ НЕ НАЙДЕН в clients');
      }
    } else {
      console.log('   ❌ НЕ НАЙДЕН в external_refs\n');
    }
    
    // 3. Последние события для этого клиента
    console.log('\n3️⃣ Последние события для client 381296...');
    const events = await sql`
      SELECT 
        id,
        ts,
        event_name,
        entity_type,
        operation,
        rentprog_id,
        company_id,
        processed,
        payload,
        metadata
      FROM events
      WHERE rentprog_id = '381296'
      ORDER BY ts DESC
      LIMIT 5
    `;
    
    if (events.length > 0) {
      console.log(`   ✅ Найдено ${events.length} событий:\n`);
      events.forEach((e, idx) => {
        console.log(`   ${idx + 1}. Event ${e.id}`);
        console.log(`      Time: ${e.ts.toISOString()}`);
        console.log(`      Event Name: ${e.event_name}`);
        console.log(`      Entity Type: ${e.entity_type}`);
        console.log(`      Operation: ${e.operation}`);
        console.log(`      Company ID: ${e.company_id}`);
        console.log(`      Processed: ${e.processed}`);
        if (e.payload) {
          console.log(`      Payload: ${JSON.stringify(e.payload, null, 2)}`);
        }
        console.log('');
      });
    } else {
      console.log('   ❌ Нет событий для client 381296\n');
    }
    
    console.log('✅ Проверка завершена!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkClient();

