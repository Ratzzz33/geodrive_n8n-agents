/**
 * Тесты для логгера
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  let originalConsoleLog: typeof console.log;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalConsoleLog = console.log;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    delete process.env.LOG_LEVEL;
  });

  describe('debug', () => {
    it('должен логировать debug сообщения когда LOG_LEVEL=debug', async () => {
      process.env.LOG_LEVEL = 'debug';
      // Перезагружаем модуль для применения нового LOG_LEVEL
      await vi.resetModules();
      const { logger: testLogger } = await import('./logger');
      
      testLogger.debug('Test debug message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toContain('[DEBUG]');
      expect(call[1]).toBe('Test debug message');
    });

    it('не должен логировать debug когда LOG_LEVEL=info', async () => {
      process.env.LOG_LEVEL = 'info';
      await vi.resetModules();
      const { logger: testLogger } = await import('./logger');
      
      testLogger.debug('Test debug message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('должен логировать info сообщения', () => {
      logger.info('Test info message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toContain('[INFO]');
      expect(call[1]).toBe('Test info message');
    });

    it('должен логировать info с дополнительными аргументами', () => {
      logger.info('Test message', { key: 'value' }, 123);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).toBe('Test message');
      expect(call[2]).toEqual({ key: 'value' });
      expect(call[3]).toBe(123);
    });
  });

  describe('warn', () => {
    it('должен логировать warn сообщения', () => {
      logger.warn('Test warning');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toContain('[WARN]');
      expect(call[1]).toBe('Test warning');
    });
  });

  describe('error', () => {
    it('должен логировать error сообщения', () => {
      logger.error('Test error');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toContain('[ERROR]');
      expect(call[1]).toBe('Test error');
    });

    it('должен логировать error с объектом ошибки', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).toBe('Error occurred');
      expect(call[2]).toBe(error);
    });
  });

  describe('timestamp format', () => {
    it('должен включать ISO timestamp в логах', () => {
      logger.info('Test');
      
      const call = consoleLogSpy.mock.calls[0];
      const logLine = call[0] as string;
      
      // Проверяем формат ISO timestamp
      expect(logLine).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('log levels hierarchy', () => {
    it('error должен логироваться при любом LOG_LEVEL', async () => {
      process.env.LOG_LEVEL = 'error';
      await vi.resetModules();
      const { logger: testLogger } = await import('./logger');
      
      testLogger.error('Error message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('warn должен логироваться при LOG_LEVEL=warn и выше', async () => {
      process.env.LOG_LEVEL = 'warn';
      await vi.resetModules();
      const { logger: testLogger } = await import('./logger');
      
      testLogger.warn('Warning message');
      testLogger.error('Error message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('info не должен логироваться при LOG_LEVEL=error', async () => {
      process.env.LOG_LEVEL = 'error';
      await vi.resetModules();
      const { logger: testLogger } = await import('./logger');
      
      testLogger.info('Info message');
      testLogger.error('Error message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });
});

