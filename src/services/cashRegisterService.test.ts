/**
 * Тесты для сервиса касс сотрудников
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CashOperation, Currency, EmployeeCash } from './cashRegisterService';

// Мокируем postgres
const mockSqlUnsafe = vi.fn().mockResolvedValue([]);
const mockSqlQuery = vi.fn().mockResolvedValue([]);

// Создаем функцию-тег для template literals
const mockSqlTag = vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
  return mockSqlQuery();
});

vi.mock('postgres', () => {
  return {
    default: vi.fn(() => {
      const sql = mockSqlTag;
      sql.unsafe = mockSqlUnsafe;
      return sql;
    }),
  };
});

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CashRegisterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateEmployeeCash', () => {
    it('должен обновить кассу сотрудника при добавлении средств', async () => {
      const { updateEmployeeCash } = await import('./cashRegisterService');
      
      const operation: CashOperation = {
        employeeId: 'test-employee-id',
        currency: 'gel',
        amount: 100,
        operation: 'add',
        source: 'ui_event',
        description: 'Test operation',
      };

      await updateEmployeeCash(operation);

      expect(mockSqlUnsafe).toHaveBeenCalled();
      const query = mockSqlUnsafe.mock.calls[0][0] as string;
      expect(query).toContain('UPDATE employees');
      expect(query).toContain('cash_gel');
      expect(query).toContain('+');
      expect(query).toContain('100');
    });

    it('должен обновить кассу сотрудника при вычитании средств', async () => {
      const { updateEmployeeCash } = await import('./cashRegisterService');
      
      const operation: CashOperation = {
        employeeId: 'test-employee-id',
        currency: 'usd',
        amount: 50,
        operation: 'subtract',
        source: 'api',
      };

      await updateEmployeeCash(operation);

      expect(mockSqlUnsafe).toHaveBeenCalled();
      const query = mockSqlUnsafe.mock.calls[0][0] as string;
      expect(query).toContain('cash_usd');
      expect(query).toContain('-');
      expect(query).toContain('50');
    });

    it('должен обновить cash_last_updated при изменении кассы', async () => {
      const { updateEmployeeCash } = await import('./cashRegisterService');
      
      const operation: CashOperation = {
        employeeId: 'test-employee-id',
        currency: 'eur',
        amount: 25,
        operation: 'add',
        source: 'manual',
      };

      await updateEmployeeCash(operation);

      const query = mockSqlUnsafe.mock.calls[0][0] as string;
      expect(query).toContain('cash_last_updated = NOW()');
    });

    it('должен работать со всеми валютами', async () => {
      const { updateEmployeeCash } = await import('./cashRegisterService');
      
      const currencies: Currency[] = ['gel', 'usd', 'eur'];
      
      for (const currency of currencies) {
        mockSqlUnsafe.mockClear();
        
        const operation: CashOperation = {
          employeeId: 'test-employee-id',
          currency,
          amount: 10,
          operation: 'add',
          source: 'test',
        };

        await updateEmployeeCash(operation);

        const query = mockSqlUnsafe.mock.calls[0][0] as string;
        expect(query).toContain(`cash_${currency}`);
      }
    });
  });

  describe('getEmployeeCash', () => {
    it('должен вернуть кассу сотрудника если он существует', async () => {
      const mockEmployee: EmployeeCash = {
        employeeId: 'test-employee-id',
        employeeName: 'Test Employee',
        cash_gel: 1000,
        cash_usd: 500,
        cash_eur: 300,
        cash_last_updated: new Date(),
        cash_last_synced: new Date(),
      };

      mockSqlQuery.mockResolvedValueOnce([mockEmployee]);

      const { getEmployeeCash } = await import('./cashRegisterService');
      const result = await getEmployeeCash('test-employee-id');

      expect(result).toBeDefined();
      expect(result?.employeeId).toBe('test-employee-id');
      expect(result?.cash_gel).toBe(1000);
      expect(result?.cash_usd).toBe(500);
      expect(result?.cash_eur).toBe(300);
    });

    it('должен вернуть null если сотрудник не найден', async () => {
      mockSqlQuery.mockResolvedValueOnce([]);

      const { getEmployeeCash } = await import('./cashRegisterService');
      const result = await getEmployeeCash('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getEmployeeCashByName', () => {
    it('должен найти сотрудника по имени', async () => {
      const mockEmployee: EmployeeCash = {
        employeeId: 'test-employee-id',
        employeeName: 'Test Employee',
        cash_gel: 1000,
        cash_usd: 0,
        cash_eur: 0,
        cash_last_updated: null,
        cash_last_synced: null,
      };

      mockSqlQuery.mockResolvedValueOnce([mockEmployee]);

      const { getEmployeeCashByName } = await import('./cashRegisterService');
      const result = await getEmployeeCashByName('Test Employee');

      expect(result).toBeDefined();
      expect(result?.employeeName).toBe('Test Employee');
    });

    it('должен вернуть null если сотрудник с таким именем не найден', async () => {
      mockSqlQuery.mockResolvedValueOnce([]);

      const { getEmployeeCashByName } = await import('./cashRegisterService');
      const result = await getEmployeeCashByName('Non Existent');

      expect(result).toBeNull();
    });
  });
});

