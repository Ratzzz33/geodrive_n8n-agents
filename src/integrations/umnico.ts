/**
 * Интеграция с Umnico API
 * Заглушки для MVP
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

let client: AxiosInstance | null = null;

/**
 * Получить клиент Umnico API
 */
function getClient(): AxiosInstance {
  if (!client) {
    if (!config.umnicoApiToken) {
      throw new Error('UMNICO_API_TOKEN не установлен');
    }

    client = axios.create({
      baseURL: config.umnicoApiUrl || 'https://api.umnico.com',
      headers: {
        Authorization: `Bearer ${config.umnicoApiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  return client;
}

/**
 * Отправка сообщения клиенту через Umnico
 * @param clientId - ID клиента в Umnico
 * @param message - Текст сообщения
 * @param channel - Канал (whatsapp/telegram)
 */
export async function sendMessage(
  clientId: string,
  message: string,
  channel: 'whatsapp' | 'telegram' = 'whatsapp'
): Promise<void> {
  logger.debug(`sendMessage to client ${clientId} via ${channel}`);
  // TODO: Реализовать отправку через Umnico API
  // const client = getClient();
  // await client.post('/messages', { clientId, message, channel });
}

/**
 * Парсинг webhook от Umnico
 * @param payload - Тело webhook запроса
 * @returns Распарсенные данные
 */
export function parseWebhook(payload: unknown): {
  type: 'message.incoming' | 'message.sent' | 'unknown';
  clientId: string;
  messageId: string;
  text: string;
  channel: 'whatsapp' | 'telegram';
} {
  logger.debug('parseWebhook called');
  // TODO: Реализовать парсинг реального формата webhook
  // В MVP возвращаем заглушку
  return {
    type: 'unknown',
    clientId: 'stub_client_id',
    messageId: 'stub_message_id',
    text: '',
    channel: 'whatsapp',
  };
}

/**
 * Проверка доступности API Umnico
 */
export async function checkUmnicoHealth(): Promise<boolean> {
  if (!config.umnicoApiToken) {
    return false;
  }
  // TODO: Реализовать реальную проверку
  return true;
}

