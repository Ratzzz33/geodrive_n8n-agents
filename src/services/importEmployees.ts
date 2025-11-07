/**
 * Импорт сотрудников из RentProg API
 * Заполняет таблицы: rentprog_employees, employees, external_refs
 */

import { initDatabase, getDatabase, getSqlConnection } from '../db/index.js';
import { employees } from '../db/schema.js';
import { randomUUID } from 'crypto';

// Bearer токены для каждого филиала (обновлено 2025-11-07)
const TOKENS: Record<string, string> = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

const COMPANY_IDS: Record<string, number> = {
  'service-center': 19283,
  'tbilisi': 9247,
  'batumi': 9247,
  'kutaisi': 9360
};

const BASE_URL = 'https://rentprog.net/api/v1';

interface RentProgEmployee {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  active?: boolean;
  last_activity?: string;
  last_login?: string;
  account?: { cash?: number; id?: number };
  currency_accounts?: Array<{ currency_id: number; cash: number }>;
  traccar_id?: number | null;
  traccar_password?: string | null;
  vote_up?: number;
  vote_down?: number;
  [key: string]: any;
}

/**
 * Извлечь структурированные поля из данных RentProg сотрудника
 */
function extractEmployeeFields(user: RentProgEmployee) {
  // Извлекаем суммы из currency_accounts по currency_id
  const currencyAccounts = user.currency_accounts || [];
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
    email: user.email || null,
    role: user.role || null,
    active: user.active !== undefined ? user.active : true,
    last_login: user.last_login || null,
    account_cash: user.account?.cash || null,
    account_id: user.account?.id || null,
    cash_gel: cashGel,
    cash_usd: cashUsd,
    cash_eur: cashEur,
    traccar_id: user.traccar_id || null,
    traccar_password: user.traccar_password || null,
    vote_up: user.vote_up || 0,
    vote_down: user.vote_down || 0,
  };
}

/**
 * Получить список сотрудников через API /users
 */
async function getUsers(branch: string): Promise<RentProgEmployee[]> {
  const token = TOKENS[branch];
  
  try {
    // Используем нативный fetch (доступен в Node.js 18+)
    const response = await globalThis.fetch(`${BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ ${branch}: HTTP ${response.status}`);
      return [];
    }
    
    const json: any = await response.json();
    
    // API возвращает массив напрямую
    if (Array.isArray(json)) {
      return json as RentProgEmployee[];
    }
    
    console.error(`❌ ${branch}: Unexpected response format`, typeof json);
    return [];
    
  } catch (error) {
    console.error(`❌ ${branch}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Импорт всех сотрудников
 */
export async function importAllEmployees() {
  console.log('🚀 Starting employee import from RentProg...\n');
  
  const sql = getSqlConnection();
  
  let totalImported = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  
  for (const branch of Object.keys(TOKENS)) {
    console.log(`📥 Fetching employees for ${branch}...`);
    
    const users = await getUsers(branch);
    console.log(`   Found: ${users.length} users`);
    
    if (users.length === 0) continue;
    
    for (const user of users) {
      try {
        const rentprogId = String(user.id);
        const companyId = COMPANY_IDS[branch];
        
        // Извлекаем структурированные данные
        const extracted = extractEmployeeFields(user);
        
        // 1. Upsert в rentprog_employees с разнесенными полями
        await sql`
          INSERT INTO rentprog_employees (
            id, rentprog_id, name, first_name, last_name, 
            company_id, email, role, active, last_login,
            account_cash, account_id, cash_gel, cash_usd, cash_eur,
            traccar_id, traccar_password, vote_up, vote_down,
            data, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(),
            ${rentprogId},
            ${user.name || null},
            ${user.first_name || null},
            ${user.last_name || null},
            ${companyId},
            ${extracted.email},
            ${extracted.role},
            ${extracted.active},
            ${extracted.last_login},
            ${extracted.account_cash},
            ${extracted.account_id},
            ${extracted.cash_gel},
            ${extracted.cash_usd},
            ${extracted.cash_eur},
            ${extracted.traccar_id},
            ${extracted.traccar_password},
            ${extracted.vote_up},
            ${extracted.vote_down},
            NULL,  -- data очищаем для визуального контроля
            NOW(),
            NOW()
          )
          ON CONFLICT (rentprog_id) 
          DO UPDATE SET
            name = EXCLUDED.name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            active = EXCLUDED.active,
            last_login = EXCLUDED.last_login,
            account_cash = EXCLUDED.account_cash,
            account_id = EXCLUDED.account_id,
            cash_gel = EXCLUDED.cash_gel,
            cash_usd = EXCLUDED.cash_usd,
            cash_eur = EXCLUDED.cash_eur,
            traccar_id = EXCLUDED.traccar_id,
            traccar_password = EXCLUDED.traccar_password,
            vote_up = EXCLUDED.vote_up,
            vote_down = EXCLUDED.vote_down,
            data = NULL,  -- data очищаем для визуального контроля
            updated_at = NOW()
        `;
        
        // 2. Проверяем есть ли в external_refs
        const existingRef = await sql`
          SELECT entity_id FROM external_refs
          WHERE entity_type = 'employee' 
            AND system = 'rentprog'
            AND external_id = ${rentprogId}
          LIMIT 1
        `;
        
        let employeeId: string;
        
        if (existingRef.length > 0) {
          // Уже есть связь
          employeeId = existingRef[0].entity_id;
          totalUpdated++;
        } else {
          // Создаем новую запись в employees
          employeeId = randomUUID();
          
          await sql`
            INSERT INTO employees (id, created_at, updated_at)
            VALUES (${employeeId}, NOW(), NOW())
          `;
          
          // Создаем связь в external_refs
          await sql`
            INSERT INTO external_refs (
              entity_type, entity_id, system, external_id, 
              branch_code, data, created_at
            )
            VALUES (
              'employee',
              ${employeeId},
              'rentprog',
              ${rentprogId},
              ${branch},
              ${JSON.stringify(user)}::jsonb,
              NOW()
            )
          `;
          
          totalCreated++;
        }
        
        totalImported++;
        
      } catch (error) {
        console.error(`   ❌ Error importing user ${user.id}:`, error instanceof Error ? error.message : error);
      }
    }
    
    console.log(`   ✅ Imported: ${users.length} users\n`);
  }
  
  console.log(`\n🎉 Import completed!`);
  console.log(`   Total imported: ${totalImported}`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
}

// Если запущено напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase()
    .then(() => importAllEmployees())
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

