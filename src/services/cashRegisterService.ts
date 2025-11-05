/**
 * Сервис для работы с кассой сотрудников
 * Обновление, получение и сверка касс
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const sql = postgres(CONNECTION_STRING, { max: 10, ssl: { rejectUnauthorized: false } });

export type Currency = 'gel' | 'usd' | 'eur';

export interface EmployeeCash {
  employeeId: string;
  employeeName: string;
  cash_gel: number;
  cash_usd: number;
  cash_eur: number;
  cash_last_updated: Date | null;
  cash_last_synced: Date | null;
}

export interface CashOperation {
  employeeId: string;
  currency: Currency;
  amount: number;
  operation: 'add' | 'subtract';
  source: string; // 'ui_event', 'api', 'manual'
  description?: string;
}

/**
 * Обновить кассу сотрудника
 */
export async function updateEmployeeCash(params: CashOperation): Promise<void> {
  const { employeeId, currency, amount, operation, source, description } = params;

  const cashField = `cash_${currency}`;
  const operator = operation === 'add' ? '+' : '-';

  await sql.unsafe(`
    UPDATE employees 
    SET 
      ${cashField} = ${cashField} ${operator} ${amount},
      cash_last_updated = NOW()
    WHERE id = '${employeeId}'
  `);

  console.log(
    `💰 Updated cash for employee ${employeeId}: ${operator}${amount} ${currency.toUpperCase()} (${source})`
  );
}

/**
 * Получить кассу сотрудника
 */
export async function getEmployeeCash(employeeId: string): Promise<EmployeeCash | null> {
  const result = await sql`
    SELECT 
      id as "employeeId",
      name as "employeeName",
      cash_gel,
      cash_usd,
      cash_eur,
      cash_last_updated,
      cash_last_synced
    FROM employees
    WHERE id = ${employeeId}
  `;

  if (result.length === 0) {
    return null;
  }

  return result[0] as EmployeeCash;
}

/**
 * Получить кассу сотрудника по имени
 */
export async function getEmployeeCashByName(name: string): Promise<EmployeeCash | null> {
  const result = await sql`
    SELECT 
      id as "employeeId",
      name as "employeeName",
      cash_gel,
      cash_usd,
      cash_eur,
      cash_last_updated,
      cash_last_synced
    FROM employees
    WHERE name = ${name}
  `;

  if (result.length === 0) {
    return null;
  }

  return result[0] as EmployeeCash;
}

/**
 * Сверить кассу сотрудника с реальными данными из RentProg UI
 */
export async function reconcileCash(
  employeeId: string,
  realCash: { gel: number; usd: number; eur: number }
): Promise<{
  hasDiscrepancy: boolean;
  discrepancies: Array<{ currency: string; calculated: number; real: number; diff: number }>;
}> {
  const calculated = await getEmployeeCash(employeeId);

  if (!calculated) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  const discrepancies: Array<{
    currency: string;
    calculated: number;
    real: number;
    diff: number;
  }> = [];

  // Проверить расхождения (погрешность 0.01)
  const currencies: Array<{ key: Currency; name: string }> = [
    { key: 'gel', name: 'GEL' },
    { key: 'usd', name: 'USD' },
    { key: 'eur', name: 'EUR' },
  ];

  for (const { key, name } of currencies) {
    const calculatedValue = calculated[`cash_${key}`] || 0;
    const realValue = realCash[key] || 0;
    const diff = Math.abs(realValue - calculatedValue);

    if (diff > 0.01) {
      discrepancies.push({
        currency: name,
        calculated: calculatedValue,
        real: realValue,
        diff: realValue - calculatedValue,
      });
    }
  }

  // Если есть расхождения - исправить автоматически
  if (discrepancies.length > 0) {
    await sql`
      UPDATE employees
      SET
        cash_gel = ${realCash.gel},
        cash_usd = ${realCash.usd},
        cash_eur = ${realCash.eur},
        cash_last_synced = NOW()
      WHERE id = ${employeeId}
    `;

    console.log(`🔄 Auto-corrected cash for employee ${employeeId} (${discrepancies.length} currencies)`);
  } else {
    // Если нет расхождений - просто обновить timestamp
    await sql`
      UPDATE employees
      SET cash_last_synced = NOW()
      WHERE id = ${employeeId}
    `;
  }

  return {
    hasDiscrepancy: discrepancies.length > 0,
    discrepancies,
  };
}

/**
 * Инициализировать кассу сотрудника из RentProg UI (первый запуск)
 */
export async function initializeEmployeeCash(
  employeeId: string,
  initialCash: { gel: number; usd: number; eur: number }
): Promise<void> {
  await sql`
    UPDATE employees
    SET
      cash_gel = ${initialCash.gel},
      cash_usd = ${initialCash.usd},
      cash_eur = ${initialCash.eur},
      cash_last_updated = NOW(),
      cash_last_synced = NOW()
    WHERE id = ${employeeId}
  `;

  console.log(`✅ Initialized cash for employee ${employeeId}: GEL ${initialCash.gel}, USD ${initialCash.usd}, EUR ${initialCash.eur}`);
}

/**
 * Получить всех сотрудников с кассами для сверки
 */
export async function getAllEmployeesWithCash(): Promise<EmployeeCash[]> {
  const result = await sql`
    SELECT 
      id as "employeeId",
      name as "employeeName",
      cash_gel,
      cash_usd,
      cash_eur,
      cash_last_updated,
      cash_last_synced
    FROM employees
    WHERE role != 'inactive'
    ORDER BY name
  `;

  return result as unknown as EmployeeCash[];
}

/**
 * Форматировать уведомление о расхождении для Telegram
 */
export function formatCashDiscrepancyAlert(
  employee: EmployeeCash,
  branch: string,
  discrepancies: Array<{ currency: string; calculated: number; real: number; diff: number }>
): string {
  const lines = [
    '⚠️ Расхождение кассы сотрудника',
    '',
    `👤 Сотрудник: ${employee.employeeName}`,
    `🏢 Филиал: ${branch}`,
    '',
    '💰 Расхождение:',
  ];

  for (const d of discrepancies) {
    const sign = d.diff > 0 ? '+' : '';
    lines.push(
      `${d.currency}: Расчет ${d.calculated.toFixed(2)} | Факт ${d.real.toFixed(2)} | Разница: ${sign}${d.diff.toFixed(2)}`
    );
  }

  lines.push('');
  lines.push('✅ Касса автоисправлена из RentProg');
  lines.push(`🕐 Последняя сверка: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);

  return lines.join('\n');
}

/**
 * Экспорт для удобства
 */
export default {
  updateEmployeeCash,
  getEmployeeCash,
  getEmployeeCashByName,
  reconcileCash,
  initializeEmployeeCash,
  getAllEmployeesWithCash,
  formatCashDiscrepancyAlert,
};

