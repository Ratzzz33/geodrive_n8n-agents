/**
 * Интеграция с n8n для мониторинга и визуализации
 */

import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { BranchName } from './rentprog';

/**
 * Отправка события в n8n для мониторинга
 */
export async function sendEventToN8n(data: {
  ts: string;
  branch: string;
  type: string;
  ext_id?: string;
  ok: boolean;
  reason?: string;
}): Promise<void> {
  const baseUrl = config.n8nBaseWebhookUrl;
  if (!baseUrl) {
    logger.debug('N8N_BASE_WEBHOOK_URL not configured, skipping event log');
    return;
  }

  try {
    // Отправляем на webhook с branch в query параметре
    await axios.post(
      `${baseUrl}/rentprog-webhook?branch=${encodeURIComponent(data.branch)}`,
      {
        ts: data.ts,
        type: data.type,
        payload: {
          id: data.ext_id,
        },
        ok: data.ok,
        reason: data.reason,
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // Логируем, но не падаем
    logger.warn('Failed to send event to n8n:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Отправка статуса здоровья в n8n
 */
export async function sendHealthToN8n(data: {
  ts: string;
  branch: BranchName;
  ok: boolean;
  reason?: string;
}): Promise<void> {
  const eventsUrl = config.n8nEventsUrl;
  if (!eventsUrl) {
    return;
  }

  try {
    await axios.post(eventsUrl + '/health', data, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.warn('Failed to send health to n8n:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Отправка прогресса синхронизации в n8n
 */
export async function sendSyncProgressToN8n(data: {
  ts: string;
  branch: BranchName;
  entity: 'car' | 'client' | 'booking';
  page?: number;
  added: number;
  updated: number;
  ok: boolean;
  msg?: string;
}): Promise<void> {
  const baseUrl = config.n8nBaseWebhookUrl;
  if (!baseUrl) {
    return;
  }

  try {
    await axios.post(`${baseUrl}/sync/progress`, data, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.warn('Failed to send sync progress to n8n:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Отправка алерта в Telegram через n8n бот
 * Использует @n8n_alert_geodrive_bot для отправки уведомлений об ошибках
 * (не основной бот, специально для алертов)
 */
export async function sendTelegramAlert(message: string): Promise<void> {
  const botToken = config.n8nAlertsTelegramBotToken;
  if (!botToken) {
    logger.debug('N8N_ALERTS_TELEGRAM_BOT_TOKEN not configured (bot: @n8n_alert_geodrive_bot)');
    return;
  }

  // Если есть URL для алертов - используем его, иначе напрямую в Telegram
  const alertsUrl = config.n8nAlertsUrl;
  if (alertsUrl) {
    try {
      await axios.post(alertsUrl, { message }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return;
    } catch (error) {
      logger.warn('Failed to send alert via n8n:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Fallback: прямая отправка в Telegram (если нужно)
  // Для MVP используем только n8n webhook
}

