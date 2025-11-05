import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkDynamicTestResult() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка результатов динамического создания схемы...\n');

  try {
    // 1. Проверить external_refs
    console.log('1️⃣ Проверка external_refs...');
    const externalRef = await sql`
      SELECT * FROM external_refs 
      WHERE system = 'rentprog' 
      AND external_id = '999999';
    `;

    if (externalRef.length > 0) {
      console.log('   ✅ Запись найдена!');
      console.log('   Entity ID:', externalRef[0].entity_id);
      console.log('   Data:', JSON.stringify(externalRef[0].data, null, 2));
    } else {
      console.log('   ❌ Запись НЕ найдена');
    }

    // 2. Проверить новые колонки в clients
    console.log('\n2️⃣ Проверка новых колонок в таблице clients...');
    const newColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
      AND column_name IN ('whatsapp', 'telegram', 'passport_expiry', 'preferred_language', 'notes')
      ORDER BY column_name;
    `;

    if (newColumns.length > 0) {
      console.log(`   ✅ Найдено ${newColumns.length} новых колонок:\n`);
      newColumns.forEach(col => {
        console.log(`   ✓ ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } else {
      console.log('   ❌ Новые колонки НЕ найдены');
    }

    // 3. Проверить данные в clients
    if (externalRef.length > 0) {
      console.log('\n3️⃣ Проверка данных в таблице clients...');
      const clientData = await sql`
        SELECT 
          id, 
          name, 
          phone, 
          email,
          whatsapp,
          telegram,
          passport_expiry,
          preferred_language,
          notes,
          created_at
        FROM clients
        WHERE id = ${externalRef[0].entity_id};
      `;

      if (clientData.length > 0) {
        console.log('   ✅ Данные найдены:\n');
        const client = clientData[0];
        console.log(`   Name: ${client.name}`);
        console.log(`   Phone: ${client.phone}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   WhatsApp: ${client.whatsapp}`);
        console.log(`   Telegram: ${client.telegram}`);
        console.log(`   Passport Expiry: ${client.passport_expiry}`);
        console.log(`   Preferred Language: ${client.preferred_language}`);
        console.log(`   Notes: ${client.notes}`);
      } else {
        console.log('   ❌ Данные НЕ найдены в clients');
      }
    }

    // 4. Проверить последнее событие
    console.log('\n4️⃣ Проверка события в events...');
    const event = await sql`
      SELECT * FROM events 
      WHERE rentprog_id = '999999'
      ORDER BY ts DESC 
      LIMIT 1;
    `;

    if (event.length > 0) {
      console.log('   ✅ Событие найдено:');
      console.log('   Event Name:', event[0].event_name);
      console.log('   Operation:', event[0].operation);
      console.log('   Entity Type:', event[0].entity_type);
      console.log('   Processed:', event[0].processed);
    }

    console.log('\n✅ Проверка завершена!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkDynamicTestResult();

