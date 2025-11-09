/**
 * Запуск миграций Starline (0012 + 0013)
 */
import postgres from 'postgres';
import fs from 'fs/promises';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function runMigrations() {
  const sql = postgres(CONNECTION_STRING, { max: 1 });
  
  try {
    console.log('📦 Запуск миграций Starline...\n');
    
    // Миграция 0012 - gps_tracking
    try {
      const migration12 = await fs.readFile('drizzle/migrations/0012_gps_tracking.sql', 'utf8');
      
      // Разбиваем на отдельные SQL statements
      const statements = migration12
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      console.log(`1️⃣  Миграция 0012 (${statements.length} операций)...`);
      
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
      
      console.log('   ✅ Миграция 0012 выполнена\n');
    } catch (error) {
      if (error.code === '42P07' || error.message.includes('already exists')) {
        console.log('   ℹ️  Миграция 0012 уже применена\n');
      } else {
        throw error;
      }
    }
    
    // Миграция 0013 - starline_devices
    try {
      const migration13 = await fs.readFile('drizzle/migrations/0013_starline_devices.sql', 'utf8');
      
      // Разбиваем на отдельные SQL statements
      const statements = migration13
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      console.log(`2️⃣  Миграция 0013 (${statements.length} операций)...`);
      
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
      
      console.log('   ✅ Миграция 0013 выполнена\n');
    } catch (error) {
      if (error.code === '42P07' || error.message.includes('already exists')) {
        console.log('   ℹ️  Миграция 0013 уже применена\n');
      } else {
        throw error;
      }
    }
    
    console.log('🎉 Все миграции выполнены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();

