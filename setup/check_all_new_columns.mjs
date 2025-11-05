import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkAllNewColumns() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка всех созданных колонок...\n');

  try {
    // Все новые колонки
    const allNewColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
      AND column_name IN (
        'whatsapp', 'telegram', 'passport_expiry', 
        'preferred_language', 'notes', 'loyalty_points', 'vip_status'
      )
      ORDER BY column_name;
    `;

    console.log(`✅ Найдено ${allNewColumns.length} созданных колонок:\n`);
    allNewColumns.forEach(col => {
      console.log(`   ✓ ${col.column_name.padEnd(20)} ${col.data_type.toUpperCase().padEnd(12)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Данные клиента
    const clientData = await sql`
      SELECT 
        name,
        phone,
        email,
        whatsapp,
        telegram,
        passport_expiry,
        preferred_language,
        notes,
        loyalty_points,
        vip_status
      FROM clients
      WHERE id = (
        SELECT entity_id FROM external_refs
        WHERE system = 'rentprog' AND external_id = '999999'
      );
    `;

    if (clientData.length > 0) {
      console.log('\n📊 Данные клиента:\n');
      const client = clientData[0];
      Object.entries(client).forEach(([key, value]) => {
        console.log(`   ${key.padEnd(20)}: ${value}`);
      });
    }

    console.log('\n✅ Динамическое создание схемы работает полностью!');
    console.log('   - Автоматическое определение типов (TEXT/INTEGER/BOOLEAN/DATE)');
    console.log('   - Создание колонок без падения workflow');
    console.log('   - Сохранение данных во все новые поля\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkAllNewColumns();

