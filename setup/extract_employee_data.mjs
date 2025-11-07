import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Извлечь поля из data для сотрудника
 */
function extractEmployeeFields(data) {
  if (!data) return {};
  
  // Извлекаем суммы из currency_accounts по currency_id
  const currencyAccounts = data.currency_accounts || [];
  let cashGel = null;
  let cashUsd = null;
  let cashEur = null;
  
  for (const account of currencyAccounts) {
    // currency_id: 39 = GEL, 1 = USD, 3 = EUR
    if (account.currency_id === 39) {
      cashGel = account.cash;
    } else if (account.currency_id === 1) {
      cashUsd = account.cash;
    } else if (account.currency_id === 3) {
      cashEur = account.cash;
    }
  }
  
  return {
    email: data.email || null,
    role: data.role || null,
    active: data.active !== undefined ? data.active : true,
    last_login: data.last_login ? new Date(data.last_login) : null,
    account_cash: data.account?.cash || null,
    account_id: data.account?.id || null,
    cash_gel: cashGel,
    cash_usd: cashUsd,
    cash_eur: cashEur,
    traccar_id: data.traccar_id || null,
    traccar_password: data.traccar_password || null,
    vote_up: data.vote_up || 0,
    vote_down: data.vote_down || 0,
  };
}

try {
  console.log('📋 Step 1: Applying migration...\n');
  
  const migrationSQL = readFileSync('setup/expand_rentprog_employees.sql', 'utf-8');
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Migration applied\n');
  
  console.log('📋 Step 2: Extracting data from JSON to columns...\n');
  
  // Получаем всех сотрудников с data
  const employees = await sql`
    SELECT id, rentprog_id, data
    FROM rentprog_employees
    WHERE data IS NOT NULL
  `;
  
  console.log(`Found ${employees.length} employees with data\n`);
  
  let updated = 0;
  
  for (const employee of employees) {
    try {
      const extracted = extractEmployeeFields(employee.data);
      
      // Обновляем запись
      await sql`
        UPDATE rentprog_employees
        SET 
          email = ${extracted.email},
          role = ${extracted.role},
          active = ${extracted.active},
          last_login = ${extracted.last_login},
          account_cash = ${extracted.account_cash},
          account_id = ${extracted.account_id},
          cash_gel = ${extracted.cash_gel},
          cash_usd = ${extracted.cash_usd},
          cash_eur = ${extracted.cash_eur},
          traccar_id = ${extracted.traccar_id},
          traccar_password = ${extracted.traccar_password},
          vote_up = ${extracted.vote_up},
          vote_down = ${extracted.vote_down},
          data = NULL,  -- ОЧИЩАЕМ для визуального контроля
          updated_at = NOW()
        WHERE id = ${employee.id}
      `;
      
      updated++;
      
      if (updated % 20 === 0) {
        console.log(`   Processed ${updated}/${employees.length}...`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error updating employee ${employee.rentprog_id}:`, error.message);
    }
  }
  
  console.log(`\n✅ Updated ${updated} employees`);
  console.log('✅ data column cleared for visual control\n');
  
  // Проверяем результат
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(email) as with_email,
      COUNT(role) as with_role,
      COUNT(cash_gel) as with_cash_gel,
      COUNT(CASE WHEN data IS NULL THEN 1 END) as data_cleared
    FROM rentprog_employees
  `;
  
  console.log('📊 Final stats:');
  console.log(`   Total employees: ${stats[0].total}`);
  console.log(`   With email: ${stats[0].with_email}`);
  console.log(`   With role: ${stats[0].with_role}`);
  console.log(`   With cash_gel: ${stats[0].with_cash_gel}`);
  console.log(`   Data cleared: ${stats[0].data_cleared}`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await sql.end();
}

