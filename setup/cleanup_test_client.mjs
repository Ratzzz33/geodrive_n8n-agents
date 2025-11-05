import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function cleanupTestClient() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🧹 Удаление тестового клиента ID 999999...\n');

  try {
    // Удалить из external_refs
    const deletedRefs = await sql`
      DELETE FROM external_refs 
      WHERE system = 'rentprog' 
      AND external_id = '999999'
      RETURNING entity_id;
    `;

    if (deletedRefs.length > 0) {
      console.log('✓ Удалено из external_refs:', deletedRefs[0].entity_id);
      
      // Удалить из clients
      const deletedClients = await sql`
        DELETE FROM clients 
        WHERE id = ${deletedRefs[0].entity_id}
        RETURNING id;
      `;
      
      if (deletedClients.length > 0) {
        console.log('✓ Удалено из clients:', deletedClients[0].id);
      }
    } else {
      console.log('ℹ️  Клиент 999999 не найден в БД');
    }

    // Удалить события
    const deletedEvents = await sql`
      DELETE FROM events 
      WHERE rentprog_id = '999999'
      RETURNING id;
    `;

    if (deletedEvents.length > 0) {
      console.log(`✓ Удалено событий: ${deletedEvents.length}`);
    }

    console.log('\n✅ Очистка завершена! Можно тестировать.\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

cleanupTestClient();

