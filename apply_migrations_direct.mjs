import postgres from 'postgres';
import fs from 'fs';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔧 Применение миграций напрямую через SQL...\n');
    
    const migrations = [
      {
        file: 'setup/migrations/0018_create_battery_voltage_history.sql',
        name: 'battery_voltage_history'
      },
      {
        file: 'setup/migrations/0019_create_battery_voltage_alerts.sql',
        name: 'battery_voltage_alerts'
      },
      {
        file: 'setup/migrations/0020_create_speed_history.sql',
        name: 'speed_history'
      },
      {
        file: 'setup/migrations/0021_create_speed_violations.sql',
        name: 'speed_violations'
      }
    ];
    
    for (const migration of migrations) {
      try {
        console.log(`📄 Применяю: ${migration.file}...`);
        const migrationSQL = fs.readFileSync(migration.file, 'utf8');
        
        // Выполняем весь SQL как один блок (postgres поддерживает множественные команды)
        await sql.unsafe(migrationSQL);
        
        console.log(`   ✅ Успешно применена\n`);
      } catch (error) {
        // Игнорируем ошибки "already exists" для CREATE TABLE IF NOT EXISTS
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.code === '42P07') {
          console.log(`   ⚠️  Таблица ${migration.name} уже существует, пропускаю\n`);
        } else {
          console.error(`   ❌ Ошибка: ${error.message}\n`);
          // Не прерываем выполнение, продолжаем с другими миграциями
        }
      }
    }
    
    console.log('✅ Все миграции применены');
    
    // Проверяем результат
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('speed_history', 'battery_voltage_history', 'speed_violations', 'battery_voltage_alerts')
      ORDER BY table_name
    `;
    console.log('\n📊 Созданные таблицы:');
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();

