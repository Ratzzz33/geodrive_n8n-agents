import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function createCarEvent() {
  try {
    const rentprogId = '63947';
    // Mapping филиалов на company_id
    const companies = [
      { name: 'tbilisi', id: 9247 },
      { name: 'batumi', id: 9248 },
      { name: 'kutaisi', id: 9506 },
      { name: 'service-center', id: 11163 }
    ];

    console.log(`📝 Создание события для синхронизации машины (RentProg ID: ${rentprogId})...\n`);

    // Пробуем создать событие для каждого филиала
    for (const company of companies) {
      try {
        const result = await sql`
          INSERT INTO events (
            company_id, 
            type, 
            event_name,
            entity_type,
            operation,
            rentprog_id, 
            ok, 
            processed
          )
          VALUES (
            ${company.id}, 
            'car.update', 
            'car.update',
            'car',
            'update',
            ${rentprogId}, 
            TRUE, 
            FALSE
          )
          ON CONFLICT (company_id, type, rentprog_id) DO NOTHING
          RETURNING id, company_id
        `;

        if (result.length > 0) {
          console.log(`✅ Событие создано для филиала: ${company.name} (company_id: ${company.id}, event_id: ${result[0].id})`);
        } else {
          console.log(`ℹ️  Событие уже существует для филиала: ${company.name} (company_id: ${company.id})`);
        }
      } catch (error) {
        console.error(`❌ Ошибка для филиала ${company.name}:`, error.message);
      }
    }

    console.log('\n💡 События созданы в таблице events');
    console.log('   Upsert Processor обработает их в течение 5 минут');
    console.log('   Или можно запустить workflow вручную');
    console.log('\n📋 После синхронизации запустите:');
    console.log('   node wait_and_match_jeep.mjs');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Запускаем
createCarEvent();

