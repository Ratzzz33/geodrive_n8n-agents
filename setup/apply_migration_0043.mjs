import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('📥 Подключаюсь к БД...\n');
  
  try {
    console.log('✅ Подключено к БД\n');
    
    // Читаем миграцию
    const migrationPath = path.join(__dirname, 'migrations', '0043_fix_null_string_in_dynamic_upsert.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Применяю миграцию 0043...\n');
    console.log('   Обновляю функцию dynamic_upsert_entity');
    console.log('   Добавляю фильтрацию строки "null"\n');
    
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Миграция применена успешно!\n');
    console.log('📋 Изменения:');
    console.log('   ✅ Функция dynamic_upsert_entity теперь фильтрует строку "null"');
    console.log('   ✅ Защита от затирания данных улучшена');
    
    // Проверяем, что функция обновлена
    const checkResult = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'dynamic_upsert_entity'
      AND pronargs = 3
      LIMIT 1
    `;
    
    if (checkResult.length > 0) {
      const definition = checkResult[0].definition;
      if (definition.includes("LOWER(TRIM(v_value_text)) = 'null'")) {
        console.log('\n✅ Проверка: функция обновлена корректно');
      } else {
        console.log('\n⚠️  Предупреждение: функция может быть не обновлена');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });

