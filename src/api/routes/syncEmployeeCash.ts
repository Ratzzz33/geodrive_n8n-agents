/**
 * Endpoint для синхронизации касс сотрудников из RentProg
 * Собирает данные из всех 4 филиалов, сравнивает с БД, обновляет при расхождениях
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import { getSqlConnection } from '../../db/index.js';
import type { BranchName } from '../../integrations/rentprog.js';

const router = Router();

// Bearer токены для каждого филиала (из importEmployees.ts)
const TOKENS: Record<BranchName, string> = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

const BASE_URL = 'https://rentprog.net/api/v1';

interface RentProgUser {
  id: number;
  name?: string;
  email?: string;
  active?: boolean;
  currency_accounts?: Array<{
    currency_id: number;
    cash: number;
  }>;
}

interface EmployeeCash {
  rentprog_id: string;
  cash_gel: number;
  cash_usd: number;
  cash_eur: number;
}

interface Discrepancy {
  rentprog_id: string;
  employee_name: string;
  branch: BranchName;
  old_gel: number;
  new_gel: number;
  old_usd: number;
  new_usd: number;
  old_eur: number;
  new_eur: number;
}

/**
 * Получить users из RentProg API для филиала
 */
async function getUsersFromRentProg(branch: BranchName): Promise<RentProgUser[]> {
  const token = TOKENS[branch];
  
  try {
    const response = await globalThis.fetch(`${BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.ok) {
      logger.error(`[Sync Cash] ${branch}: HTTP ${response.status}`);
      return [];
    }
    
    const json: any = await response.json();
    
    if (Array.isArray(json)) {
      return json as RentProgUser[];
    }
    
    logger.error(`[Sync Cash] ${branch}: Unexpected response format`);
    return [];
    
  } catch (error) {
    logger.error(`[Sync Cash] ${branch}:`, error);
    return [];
  }
}

/**
 * Извлечь кассы из currency_accounts
 */
function extractCash(user: RentProgUser): { gel: number; usd: number; eur: number } {
  const currencyAccounts = user.currency_accounts || [];
  let gel = 0;
  let usd = 0;
  let eur = 0;
  
  for (const account of currencyAccounts) {
    // currency_id: 39 = GEL, 1 = USD, 3 = EUR
    if (account.currency_id === 39) {
      gel = account.cash || 0;
    } else if (account.currency_id === 1) {
      usd = account.cash || 0;
    } else if (account.currency_id === 3) {
      eur = account.cash || 0;
    }
  }
  
  return { gel, usd, eur };
}

/**
 * Получить данные о кассах из БД
 */
async function getEmployeesFromDB(): Promise<Map<string, EmployeeCash & { employee_name: string }>> {
  const sql = getSqlConnection();
  
  const employees = await sql<Array<EmployeeCash & { employee_name: string }>>`
    SELECT 
      re.rentprog_id,
      re.name as employee_name,
      COALESCE(re.cash_gel, 0) as cash_gel,
      COALESCE(re.cash_usd, 0) as cash_usd,
      COALESCE(re.cash_eur, 0) as cash_eur
    FROM rentprog_employees re
    WHERE re.rentprog_id IS NOT NULL
  `;
  
  const map = new Map<string, EmployeeCash & { employee_name: string }>();
  for (const emp of employees) {
    map.set(emp.rentprog_id, emp);
  }
  
  return map;
}

/**
 * Обновить кассы в БД
 */
async function updateCashInDB(
  rentprogId: string,
  cashGel: number,
  cashUsd: number,
  cashEur: number
): Promise<void> {
  const sql = getSqlConnection();
  
  await sql`
    UPDATE rentprog_employees
    SET 
      cash_gel = ${cashGel},
      cash_usd = ${cashUsd},
      cash_eur = ${cashEur},
      updated_at = NOW()
    WHERE rentprog_id = ${rentprogId}
  `;
}

/**
 * POST /sync-employee-cash
 * Синхронизация касс сотрудников из всех филиалов
 */
router.post('/sync-employee-cash', async (req, res) => {
  try {
    logger.info('[Sync Cash] Starting employee cash synchronization...');
    
    const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    
    // 1. Получаем данные из всех филиалов (параллельно)
    logger.info('[Sync Cash] Fetching users from RentProg...');
    const branchUsers = await Promise.all(
      branches.map(async (branch) => {
        const users = await getUsersFromRentProg(branch);
        logger.info(`[Sync Cash] ${branch}: ${users.length} users`);
        return { branch, users };
      })
    );
    
    // 2. Агрегируем данные по филиалам (источник истины)
    const rentprogCash = new Map<string, {
      branch: BranchName;
      name: string;
      cash: { gel: number; usd: number; eur: number };
    }>();
    
    for (const { branch, users } of branchUsers) {
      for (const user of users) {
        if (!user.active) continue; // Пропускаем неактивных
        
        const rentprogId = String(user.id);
        const cash = extractCash(user);
        
        // Если сотрудник уже есть в нескольких филиалах, берем последний (можно улучшить логику)
        rentprogCash.set(rentprogId, {
          branch,
          name: user.name || user.email || `User ${rentprogId}`,
          cash
        });
      }
    }
    
    logger.info(`[Sync Cash] Total active users from RentProg: ${rentprogCash.size}`);
    
    // 3. Получаем данные из БД
    logger.info('[Sync Cash] Fetching employees from DB...');
    const dbEmployees = await getEmployeesFromDB();
    logger.info(`[Sync Cash] Total employees in DB: ${dbEmployees.size}`);
    
    // 4. Сравниваем и находим расхождения
    const discrepancies: Discrepancy[] = [];
    let updated = 0;
    
    for (const [rentprogId, rpData] of rentprogCash.entries()) {
      const dbEmp = dbEmployees.get(rentprogId);
      
      if (!dbEmp) {
        // Новый сотрудник, которого нет в БД - пропускаем (не обновляем кассы для новых)
        logger.debug(`[Sync Cash] New employee (not in DB): ${rpData.name} (${rentprogId})`);
        continue;
      }
      
      // Сравниваем кассы
      const rpGel = rpData.cash.gel;
      const rpUsd = rpData.cash.usd;
      const rpEur = rpData.cash.eur;
      
      const dbGel = parseFloat(String(dbEmp.cash_gel)) || 0;
      const dbUsd = parseFloat(String(dbEmp.cash_usd)) || 0;
      const dbEur = parseFloat(String(dbEmp.cash_eur)) || 0;
      
      if (rpGel !== dbGel || rpUsd !== dbUsd || rpEur !== dbEur) {
        // Есть расхождение - обновляем БД
        await updateCashInDB(rentprogId, rpGel, rpUsd, rpEur);
        updated++;
        
        discrepancies.push({
          rentprog_id: rentprogId,
          employee_name: dbEmp.employee_name,
          branch: rpData.branch,
          old_gel: dbGel,
          new_gel: rpGel,
          old_usd: dbUsd,
          new_usd: rpUsd,
          old_eur: dbEur,
          new_eur: rpEur
        });
        
        logger.info(`[Sync Cash] Updated: ${dbEmp.employee_name} (${rentprogId}) from ${rpData.branch}`);
      }
    }
    
    // 5. Формируем отчет
    const report = {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        rentprog_users: rentprogCash.size,
        db_employees: dbEmployees.size,
        discrepancies_found: discrepancies.length,
        updated: updated
      },
      discrepancies: discrepancies.map(d => ({
        employee: d.employee_name,
        rentprog_id: d.rentprog_id,
        branch: d.branch,
        changes: {
          gel: d.old_gel !== d.new_gel ? { old: d.old_gel, new: d.new_gel } : null,
          usd: d.old_usd !== d.new_usd ? { old: d.old_usd, new: d.new_usd } : null,
          eur: d.old_eur !== d.new_eur ? { old: d.old_eur, new: d.new_eur } : null
        }
      }))
    };
    
    logger.info(`[Sync Cash] Completed: ${updated} employees updated, ${discrepancies.length} discrepancies`);
    
    res.json(report);
    
  } catch (error) {
    logger.error('[Sync Cash] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

