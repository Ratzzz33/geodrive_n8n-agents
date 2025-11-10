/**
 * Тесты для Umnico Telegram Bridge
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Моки для тестирования форматирования
describe('UmnicoTelegramBridge - Formatting', () => {
  describe('formatTopicName', () => {
    it('should format topic name with client name only', () => {
      const name = 'Иван Иванов';
      const result = formatTopicName(name);
      expect(result).toBe('Иван Иванов');
    });

    it('should format topic name with client and car', () => {
      const name = 'Иван Иванов';
      const car = 'Honda HR-V';
      const result = formatTopicName(name, car);
      expect(result).toBe('Иван Иванов | Honda HR-V');
    });

    it('should format topic name with all fields', () => {
      const name = 'Иван Иванов';
      const car = 'Honda HR-V';
      const dates = '12.11-15.11';
      const result = formatTopicName(name, car, dates);
      expect(result).toBe('Иван Иванов | Honda HR-V | 12.11-15.11');
    });

    it('should truncate to 64 characters', () => {
      const name = 'A'.repeat(70);
      const result = formatTopicName(name);
      expect(result.length).toBeLessThanOrEqual(64);
      expect(result).toBe('A'.repeat(64));
    });

    it('should handle empty car and dates', () => {
      const name = 'Иван Иванов';
      const result = formatTopicName(name, undefined, undefined);
      expect(result).toBe('Иван Иванов');
    });
  });

  describe('formatPinnedMessage', () => {
    it('should format pinned message with all fields', () => {
      const clientInfo = {
        clientId: 'uuid-123',
        name: 'Иван Иванов',
        phone: '+995599001665',
      };
      const bookingInfo = {
        carName: 'Honda HR-V',
        dates: '12.11-15.11',
      };
      const conversationId = '61965921';
      const webUrl = 'https://conversations.rentflow.rentals/conversations/61965921';

      const result = formatPinnedMessage(clientInfo, bookingInfo, conversationId, webUrl);

      expect(result).toContain('Иван Иванов');
      expect(result).toContain('+995599001665');
      expect(result).toContain('Honda HR-V');
      expect(result).toContain('12.11-15.11');
      expect(result).toContain(webUrl);
    });

    it('should format pinned message without booking info', () => {
      const clientInfo = {
        clientId: 'uuid-123',
        name: 'Иван Иванов',
        phone: '+995599001665',
      };
      const bookingInfo = {};
      const conversationId = '61965921';
      const webUrl = 'https://conversations.rentflow.rentals/conversations/61965921';

      const result = formatPinnedMessage(clientInfo, bookingInfo, conversationId, webUrl);

      expect(result).toContain('Иван Иванов');
      expect(result).toContain('+995599001665');
      expect(result).not.toContain('Автомобиль');
      expect(result).not.toContain('Даты');
    });
  });
});

// Вспомогательные функции для тестирования (копии из UmnicoTelegramBridge)
function formatTopicName(
  clientName: string,
  carName?: string,
  dates?: string
): string {
  let name = clientName;

  if (carName) {
    name += ` | ${carName}`;
  }

  if (dates) {
    name += ` | ${dates}`;
  }

  return name.substring(0, 64);
}

function formatPinnedMessage(
  clientInfo: { name: string; phone: string },
  bookingInfo: { carName?: string; dates?: string },
  conversationId: string,
  webUrl: string
): string {
  const sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const expiresAtStr = sessionExpiresAt.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let message = `<b>👤 Клиент:</b> ${clientInfo.name}\n`;
  message += `<b>📞 Телефон:</b> ${clientInfo.phone}\n\n`;

  if (bookingInfo.carName) {
    message += `<b>🚗 Автомобиль:</b> ${bookingInfo.carName}\n`;
  }

  if (bookingInfo.dates) {
    message += `<b>📅 Даты:</b> ${bookingInfo.dates}\n`;
  }

  message += `\n<b>💬 История переписки:</b>\n`;
  message += `<a href="${webUrl}">Открыть в веб-интерфейсе</a>\n\n`;
  message += `<b>⏰ Сессия активна до:</b> ${expiresAtStr}`;

  return message;
}

