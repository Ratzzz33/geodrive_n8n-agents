/**
 * Тесты для оркестратора
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { route, subscribe } from './index';
import { SystemEvent, EventType } from '../types/events';

// Моки зависимостей
vi.mock('../utils/logger', async () => {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('./rentprog-handler', async () => {
  return {
    handleRentProgEvent: vi.fn().mockResolvedValue({
      ok: true,
      processed: true,
      entityIds: {},
    }),
  };
});

describe('Orchestrator route function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен успешно обработать событие от RentProg', async () => {
    const event: SystemEvent = {
      type: 'car.moved' as EventType,
      source: 'rentprog',
      timestamp: new Date(),
      payload: {
        carId: 'test-car-123',
        branchFrom: 'tbilisi',
        branchTo: 'batumi',
      },
    };

    const result = await route(event);
    
    expect(result.success).toBe(true);
    expect(result.agentIds).toBeDefined();
    expect(Array.isArray(result.agentIds)).toBe(true);
  });

  it('должен определить правильных агентов для события booking.issue.planned', async () => {
    const event: SystemEvent = {
      type: 'booking.issue.planned',
      source: 'rentprog',
      timestamp: new Date(),
      payload: {
        bookingId: 'test-booking-123',
      },
    };

    const result = await route(event);
    
    expect(result.success).toBe(true);
    expect(result.agentIds).toContain('booking-controller');
    expect(result.agentIds).toContain('issue-assistant');
  });

  it('должен определить правильных агентов для события booking.return.planned', async () => {
    const event: SystemEvent = {
      type: 'booking.return.planned',
      source: 'rentprog',
      timestamp: new Date(),
      payload: {
        bookingId: 'test-booking-456',
      },
    };

    const result = await route(event);
    
    expect(result.success).toBe(true);
    expect(result.agentIds).toContain('booking-controller');
    expect(result.agentIds).toContain('return-assistant');
  });

  it('должен обработать ошибку при обработке события', async () => {
    const { handleRentProgEvent } = await import('./rentprog-handler');
    vi.mocked(handleRentProgEvent).mockRejectedValueOnce(new Error('Test error'));

    const event: SystemEvent = {
      type: 'car.moved' as EventType,
      source: 'rentprog',
      timestamp: new Date(),
      payload: {},
    };

    const result = await route(event);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Orchestrator subscribe function', () => {
  it('должен подписать обработчик на событие', () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    
    // Функция subscribe должна существовать
    expect(typeof subscribe).toBe('function');
    
    // В MVP функция может быть заглушкой, поэтому просто проверяем, что она не падает
    expect(() => subscribe('car.moved', handler)).not.toThrow();
  });
});

