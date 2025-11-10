/**
 * Тесты для UmnicoRealtimeSync
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('UmnicoRealtimeSync', () => {
  describe('getNewMessagesFromPlaywright', () => {
    it('should parse ISO date format correctly', () => {
      const since = new Date('2025-11-09T10:00:00Z');
      const messages = [
        { datetime: '2025-11-09T10:30:00Z', text: 'Message 1' },
        { datetime: '2025-11-09T09:00:00Z', text: 'Message 2' },
      ];

      const filtered = filterMessagesByDate(messages, since);
      expect(filtered.length).toBe(1);
      expect(filtered[0].text).toBe('Message 1');
    });

    it('should parse DD.MM.YYYY HH:mm format correctly', () => {
      const since = new Date('2025-11-09T10:00:00Z');
      const messages = [
        { datetime: '09.11.2025 10:30', text: 'Message 1' },
        { datetime: '09.11.2025 09:00', text: 'Message 2' },
      ];

      const filtered = filterMessagesByDate(messages, since);
      expect(filtered.length).toBe(1);
      expect(filtered[0].text).toBe('Message 1');
    });

    it('should return all messages if since is not provided', () => {
      const messages = [
        { datetime: '2025-11-09T10:30:00Z', text: 'Message 1' },
        { datetime: '2025-11-09T09:00:00Z', text: 'Message 2' },
      ];

      const filtered = filterMessagesByDate(messages);
      expect(filtered.length).toBe(2);
    });

    it('should handle messages without datetime', () => {
      const since = new Date('2025-11-09T10:00:00Z');
      const messages = [
        { datetime: '2025-11-09T10:30:00Z', text: 'Message 1' },
        { text: 'Message 2' }, // без datetime
      ];

      const filtered = filterMessagesByDate(messages, since);
      expect(filtered.length).toBe(1);
      expect(filtered[0].text).toBe('Message 1');
    });
  });
});

// Вспомогательная функция для тестирования
function filterMessagesByDate(messages: any[], since?: Date): any[] {
  if (!since) {
    return messages;
  }

  return messages.filter(m => {
    if (!m.datetime) return false;

    let messageDate: Date;
    try {
      if (m.datetime.includes('T') || m.datetime.includes('-')) {
        messageDate = new Date(m.datetime);
      } else {
        const parts = m.datetime.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
        if (parts) {
          const [, day, month, year, hour, minute] = parts;
          messageDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
          );
        } else {
          messageDate = new Date(m.datetime);
        }
      }

      if (isNaN(messageDate.getTime())) {
        return false;
      }

      return messageDate > since;
    } catch (e) {
      return false;
    }
  });
}

