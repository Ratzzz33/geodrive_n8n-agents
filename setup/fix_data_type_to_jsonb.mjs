import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixDataType() {
  console.log('🔧 Fixing data field type to JSONB...\n');
  
  try {
    // Проверить текущий тип
    const currentType = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'data'
    `.then(rows => rows[0]?.data_type);
    
    console.log(`Current data type: ${currentType}`);
    
    if (currentType !== 'jsonb') {
      console.log('\n1. Converting data column to JSONB...');
      
      // Конвертировать TEXT в JSONB
      await sql.unsafe(`
        ALTER TABLE bookings 
        ALTER COLUMN data TYPE JSONB USING data::JSONB
      `);
      
      console.log('   ✅ Converted to JSONB');
    } else {
      console.log('   ✅ Already JSONB');
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

fixDataType();

