/**
 * Импорт сотрудников из RentProg API
 * Заполняет таблицы: rentprog_employees, employees, external_refs
 */

import fetch from 'node-fetch';
import { getDatabase } from '../db/index.js';
import { employees } from '../db/schema.js';
import { randomUUID } from 'crypto';

// Bearer токены для каждого филиала
const TOKENS: Record<string, string> = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxOTI4MywiZXhwIjoxNzQ2NTUyMDAwfQ.F4tzmSwPzgU2SYxbgaKfBB-kLKpJIk1q3uCDZU4-8QU',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMTg1MiwiZXhwIjoxNzQ2NTUyMDAwfQ.qPq8E7zLtvRcP3zOXiJ_k7UdTBJMWw2TJixIZDbFZWI',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMjk3NiwiZXhwIjoxNzQ2NTUyMDAwfQ.dJ--AUmjYrqR0lmB1YcVXtXx2HB90DWOCebjm5KNdwU',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxNjMwNSwiZXhwIjoxNzQ2NTUyMDAwfQ.XLX4U0EIbHVR4esDj-g2GdS_7RKK6lYgpXX3EF8pbAg'
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
  [key: string]: any;
}

/**
 * Получить список сотрудников через API user_cashbox
 */
async function getUserCashbox(branch: string): Promise<RentProgEmployee[]> {
  const token = TOKENS[branch];
  
  try {
    const response = await fetch(`${BASE_URL}/user_cashbox`, {
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
    
    // Структура: { gel: [...users], usd: [...users], eur: [...users] }
    const allUsers: RentProgEmployee[] = [];
    
    if (json.gel && Array.isArray(json.gel)) {
      allUsers.push(...json.gel);
    }
    if (json.usd && Array.isArray(json.usd)) {
      allUsers.push(...json.usd);
    }
    if (json.eur && Array.isArray(json.eur)) {
      allUsers.push(...json.eur);
    }
    
    // Дедупликация по ID
    const uniqueUsers = Array.from(
      new Map(allUsers.map(u => [u.id, u])).values()
    );
    
    return uniqueUsers;
    
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
  
  const db = getDatabase();
  const { sql } = db;
  
  let totalImported = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  
  for (const branch of Object.keys(TOKENS)) {
    console.log(`📥 Fetching employees for ${branch}...`);
    
    const users = await getUserCashbox(branch);
    console.log(`   Found: ${users.length} users`);
    
    if (users.length === 0) continue;
    
    for (const user of users) {
      try {
        const rentprogId = String(user.id);
        const companyId = COMPANY_IDS[branch];
        
        // 1. Upsert в rentprog_employees
        await sql`
          INSERT INTO rentprog_employees (
            id, rentprog_id, name, first_name, last_name, 
            company_id, data, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(),
            ${rentprogId},
            ${user.name || null},
            ${user.first_name || null},
            ${user.last_name || null},
            ${companyId},
            ${JSON.stringify(user)}::jsonb,
            NOW(),
            NOW()
          )
          ON CONFLICT (rentprog_id) 
          DO UPDATE SET
            name = EXCLUDED.name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            data = EXCLUDED.data,
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
  importAllEmployees()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

