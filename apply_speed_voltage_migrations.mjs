import postgres from 'postgres';
import fs from 'fs';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔧 Применение миграций для истории скорости и вольтажа...\n');
    
    const migrations = [
      'setup/migrations/0018_create_battery_voltage_history.sql',
      'setup/migrations/0019_create_battery_voltage_alerts.sql',
      'setup/migrations/0020_create_speed_history.sql',
      'setup/migrations/0021_create_speed_violations.sql'
    ];
    
    for (const migrationFile of migrations) {
      try {
        console.log(`📄 Применяю: ${migrationFile}...`);
        const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
        await sql.unsafe(migrationSQL);
        console.log(`   ✅ Успешно применена\n`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`   ⚠️  Таблица уже существует, пропускаю\n`);
        } else {
          console.error(`   ❌ Ошибка: ${error.message}\n`);
        }
      }
    }
    
    console.log('✅ Все миграции применены');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();

