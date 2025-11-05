import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixTableStructure() {
  console.log('🔧 Проверка и исправление структуры таблиц cars и clients\n');
  
  try {
    // Проверить cars
    console.log('1️⃣ Проверка таблицы cars...');
    const carsConstraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'cars' AND constraint_type = 'PRIMARY KEY'
    `;
    
    if (carsConstraints.length === 0) {
      console.log('   ⚠️ PRIMARY KEY отсутствует в cars');
      console.log('   Добавляю PRIMARY KEY...');
      
      await sql.unsafe('ALTER TABLE cars ADD CONSTRAINT cars_pkey PRIMARY KEY (id)');
      console.log('   ✅ PRIMARY KEY добавлен в cars');
    } else {
      console.log('   ✅ PRIMARY KEY уже есть в cars');
    }
    
    // Проверить clients
    console.log('\n2️⃣ Проверка таблицы clients...');
    const clientsConstraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'clients' AND constraint_type = 'PRIMARY KEY'
    `;
    
    if (clientsConstraints.length === 0) {
      console.log('   ⚠️ PRIMARY KEY отсутствует в clients');
      console.log('   Добавляю PRIMARY KEY...');
      
      await sql.unsafe('ALTER TABLE clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id)');
      console.log('   ✅ PRIMARY KEY добавлен в clients');
    } else {
      console.log('   ✅ PRIMARY KEY уже есть в clients');
    }
    
    console.log('\n✅ Структура таблиц исправлена!');
    console.log('\nТеперь ON CONFLICT будет работать корректно.');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

fixTableStructure().catch(console.error);

