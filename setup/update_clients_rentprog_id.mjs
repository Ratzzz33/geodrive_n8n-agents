import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false } }
);

async function updateClientsRentprogId() {
  console.log('💾 Обновляю rentprog_id в таблице clients...\n');

  try {
    // Добавляем колонку rentprog_id если её нет
    console.log('1️⃣ Проверяю наличие колонки rentprog_id...');
    await sql.unsafe(`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS rentprog_id TEXT
    `);
    console.log('   ✅ Колонка готова\n');
    
    // Обновляем rentprog_id из external_refs
    console.log('2️⃣ Обновляю rentprog_id из external_refs...');
    const result = await sql.unsafe(`
      UPDATE clients c
      SET rentprog_id = er.external_id
      FROM external_refs er
      WHERE er.entity_id = c.id
        AND er.system = 'rentprog'
        AND er.entity_type = 'client'
        AND c.rentprog_id IS DISTINCT FROM er.external_id
    `);
    
    console.log(`   ✅ Обновлено клиентов: ${result.count}\n`);
    
    // Статистика
    console.log('📊 Статистика:');
    
    const [{ total }] = await sql`
      SELECT COUNT(*) as total FROM clients
    `;
    
    const [{ with_id }] = await sql`
      SELECT COUNT(*) as with_id 
      FROM clients 
      WHERE rentprog_id IS NOT NULL
    `;
    
    const [{ without_id }] = await sql`
      SELECT COUNT(*) as without_id 
      FROM clients 
      WHERE rentprog_id IS NULL
    `;
    
    console.log(`   👥 Всего клиентов: ${total}`);
    console.log(`   ✅ С rentprog_id: ${with_id} (${Math.round(with_id/total*100)}%)`);
    console.log(`   ❌ Без rentprog_id: ${without_id} (${Math.round(without_id/total*100)}%)`);
    
    // Создаём индекс для быстрого поиска
    console.log('\n3️⃣ Создаю индекс на rentprog_id...');
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_clients_rentprog_id 
      ON clients(rentprog_id) 
      WHERE rentprog_id IS NOT NULL
    `);
    console.log('   ✅ Индекс создан');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
  
  console.log('\n🎉 Готово!');
}

updateClientsRentprogId().catch(console.error);

