import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function monitorWebhooks() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n📊 Мониторинг webhooks от RentProg...\n');

  try {
    // Последние события по всем филиалам
    console.log('📋 Последние события (все филиалы):');
    const allEvents = await sql`
      SELECT 
        company_id,
        event_name,
        entity_type,
        operation,
        rentprog_id,
        ts,
        processed
      FROM events
      ORDER BY ts DESC
      LIMIT 10;
    `;

    if (allEvents.length > 0) {
      allEvents.forEach((event, idx) => {
        const companyName = {
          9247: 'Tbilisi',
          9248: 'Kutaisi',
          9506: 'Batumi',
          11163: 'Service Center'
        }[event.company_id] || `Unknown (${event.company_id})`;

        console.log(`\n   ${idx + 1}. ${event.event_name} (${companyName})`);
        console.log(`      Entity: ${event.entity_type} #${event.rentprog_id}`);
        console.log(`      Operation: ${event.operation}`);
        console.log(`      Time: ${event.ts.toISOString()}`);
        console.log(`      Processed: ${event.processed ? '✅' : '⏳'}`);
      });
    } else {
      console.log('   ℹ️  Нет событий в БД');
    }

    // Статистика по филиалам за последний час
    console.log('\n\n📊 Статистика за последний час:');
    const stats = await sql`
      SELECT 
        company_id,
        COUNT(*) as count,
        MAX(ts) as last_event
      FROM events
      WHERE ts > NOW() - INTERVAL '1 hour'
      GROUP BY company_id
      ORDER BY company_id;
    `;

    if (stats.length > 0) {
      stats.forEach(stat => {
        const companyName = {
          9247: 'Tbilisi',
          9248: 'Kutaisi',
          9506: 'Batumi',
          11163: 'Service Center'
        }[stat.company_id] || `Unknown (${stat.company_id})`;

        console.log(`\n   ${companyName}:`);
        console.log(`      События: ${stat.count}`);
        console.log(`      Последнее: ${stat.last_event.toISOString()}`);
      });
    } else {
      console.log('   ℹ️  Нет событий за последний час');
    }

    // Проверка Service Center
    console.log('\n\n🔍 Service Center (company_id: 11163):');
    const serviceCenterEvents = await sql`
      SELECT COUNT(*) as total
      FROM events
      WHERE company_id = 11163;
    `;

    console.log(`   Всего событий: ${serviceCenterEvents[0].total}`);

    const lastServiceEvent = await sql`
      SELECT *
      FROM events
      WHERE company_id = 11163
      ORDER BY ts DESC
      LIMIT 1;
    `;

    if (lastServiceEvent.length > 0) {
      const event = lastServiceEvent[0];
      console.log(`   Последнее событие:`);
      console.log(`      Type: ${event.event_name}`);
      console.log(`      Entity: ${event.entity_type} #${event.rentprog_id}`);
      console.log(`      Time: ${event.ts.toISOString()}`);
      
      const minutesAgo = Math.floor((Date.now() - event.ts.getTime()) / 1000 / 60);
      console.log(`      Давность: ${minutesAgo} минут назад`);
    } else {
      console.log('   ❌ НЕТ СОБЫТИЙ от Service Center!');
      console.log('   💡 Webhook отключен или не настроен в RentProg');
      console.log('   📖 См. docs/ENABLE_RENTPROG_WEBHOOK.md');
    }

    console.log('\n✅ Мониторинг завершен!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

monitorWebhooks();

