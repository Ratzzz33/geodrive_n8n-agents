import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixBookingsTable() {
  console.log('🔧 Fixing bookings table structure...\n');
  
  try {
    // 1. Добавить PRIMARY KEY на id если его нет
    console.log('1. Adding PRIMARY KEY on id...');
    await sql.unsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'bookings_pkey' AND conrelid = 'bookings'::regclass
        ) THEN
          ALTER TABLE bookings ADD PRIMARY KEY (id);
        END IF;
      END $$;
    `);
    console.log('   ✅ PRIMARY KEY added\n');
    
    // 2. Изменить типы числовых полей на NUMERIC
    console.log('2. Changing numeric fields to NUMERIC...');
    
    const numericFields = ['price', 'days', 'total', 'deposit'];
    
    for (const field of numericFields) {
      try {
        await sql.unsafe(`
          ALTER TABLE bookings 
          ALTER COLUMN ${field} TYPE NUMERIC USING ${field}::NUMERIC
        `);
        console.log(`   ✅ ${field} changed to NUMERIC`);
      } catch (error) {
        console.log(`   ⚠️  ${field}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Table structure fixed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

fixBookingsTable();

