#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔗 Связывание таблиц employees и rentprog_employees\n');
  console.log('='.repeat(60));

  try {
    // 1. Добавить колонку employee_id в rentprog_employees
    console.log('\n1️⃣ Добавление связи rentprog_employees → employees...');
    await sql`
      ALTER TABLE rentprog_employees 
      ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id)
    `;
    console.log('   ✅ Колонка employee_id добавлена');

    // 2. Добавить индекс
    console.log('\n2️⃣ Создание индекса...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rentprog_employees_employee_id 
      ON rentprog_employees(employee_id)
    `;
    console.log('   ✅ Индекс создан');

    // 3. Показать структуру
    console.log('\n3️⃣ Текущая структура связей...');
    console.log('');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │         employees (основная)            │');
    console.log('   │  - id (UUID)                            │');
    console.log('   │  - name, role                           │');
    console.log('   │  - tg_user_id                           │');
    console.log('   │  - cash_gel, cash_usd, cash_eur         │');
    console.log('   │  - task_chat_id                         │');
    console.log('   └────────────▲────────────────────────────┘');
    console.log('                │');
    console.log('                │ employee_id (FK)');
    console.log('                │');
    console.log('   ┌────────────┴────────────────────────────┐');
    console.log('   │    rentprog_employees (из RentProg)     │');
    console.log('   │  - id (UUID)                            │');
    console.log('   │  - rentprog_id (14714, 11855, ...)     │');
    console.log('   │  - name ("Toma Khabuliani")             │');
    console.log('   │  - employee_id → employees.id           │');
    console.log('   │  - data (JSONB)                         │');
    console.log('   └─────────────────────────────────────────┘');
    console.log('');

    console.log('\n4️⃣ Примеры использования...');
    console.log('');
    console.log('   // Найти сотрудника Jarvis по RentProg ID:');
    console.log('   SELECT e.* ');
    console.log('   FROM employees e');
    console.log('   JOIN rentprog_employees re ON re.employee_id = e.id');
    console.log('   WHERE re.rentprog_id = \'14714\';');
    console.log('');
    console.log('   // Найти всех сотрудников с их RentProg данными:');
    console.log('   SELECT ');
    console.log('     e.name as jarvis_name,');
    console.log('     e.tg_user_id,');
    console.log('     re.rentprog_id,');
    console.log('     re.name as rentprog_name');
    console.log('   FROM employees e');
    console.log('   LEFT JOIN rentprog_employees re ON re.employee_id = e.id;');
    console.log('');
    console.log('   // Получить кассу сотрудника по брони:');
    console.log('   SELECT ');
    console.log('     b.id as booking_id,');
    console.log('     e.name,');
    console.log('     e.cash_gel');
    console.log('   FROM bookings b');
    console.log('   JOIN external_refs er ON er.external_id = b.data->>\'responsible_id\'');
    console.log('   JOIN rentprog_employees re ON re.id = er.entity_id');
    console.log('   JOIN employees e ON e.id = re.employee_id;');

    console.log('\n\n5️⃣ Ручное связывание (пример)...');
    console.log('');
    console.log('   // Если у вас уже есть сотрудник в employees');
    console.log('   // и нужно связать с RentProg:');
    console.log('   UPDATE rentprog_employees');
    console.log('   SET employee_id = (');
    console.log('     SELECT id FROM employees ');
    console.log('     WHERE name = \'Toma Khabuliani\'');
    console.log('   )');
    console.log('   WHERE rentprog_id = \'14714\';');

    console.log('\n\n✅ Связь создана!');
    console.log('\n📝 Что дальше:');
    console.log('   1. Дождаться новых вебхуков - сотрудники будут автоматически собираться');
    console.log('   2. Вручную связать существующих сотрудников employees с rentprog_employees');
    console.log('   3. Использовать JOIN для получения полной информации');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

