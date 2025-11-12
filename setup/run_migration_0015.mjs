import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔧 Выполнение миграции 0015_fix_gps_tracking_conflict_key.sql...');
  
  const migrationPath = join(__dirname, 'migrations', '0015_fix_gps_tracking_conflict_key.sql');
  const content = readFileSync(migrationPath, 'utf8');
  
  await sql.unsafe(content);
  
  console.log('✅ Миграция выполнена успешно');
} catch (error) {
  console.error('❌ Ошибка при выполнении миграции:', error.message);
  if (error.detail) {
    console.error('   Детали:', error.detail);
  }
  process.exit(1);
} finally {
  await sql.end();
}

