import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔧 Выполнение миграции 0015_fix_gps_tracking_conflict_key.sql...');
  
  const content = readFileSync('setup/migrations/0015_fix_gps_tracking_conflict_key.sql', 'utf8');
  await sql.unsafe(content);
  
  console.log('✅ Миграция выполнена успешно');
} catch (error) {
  console.error('❌ Ошибка при выполнении миграции:', error);
  process.exit(1);
} finally {
  await sql.end();
}

