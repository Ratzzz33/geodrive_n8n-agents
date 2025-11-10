/**
 * Umnico Realtime Sync
 * 
 * Polling активных чатов Umnico каждые N секунд для real-time синхронизации
 * с Telegram темами
 */

import { getSqlConnection } from '../db/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { UmnicoTelegramBridge } from './umnicoTelegramBridge.js';

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';

export class UmnicoRealtimeSync {
  private bridge: UmnicoTelegramBridge;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pollingInterval: number;

  constructor() {
    this.bridge = new UmnicoTelegramBridge();
    this.pollingInterval = (config.umnicoPollingInterval || 5) * 1000; // Конвертируем в миллисекунды
  }

  /**
   * Запустить polling активных чатов
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('UmnicoRealtimeSync is already running');
      return;
    }

    logger.info(`Starting UmnicoRealtimeSync with interval ${this.pollingInterval / 1000}s`);
    this.isRunning = true;

    // Первый запуск сразу
    await this.syncActiveConversations().catch((error) => {
      logger.error('Error in initial sync:', error);
    });

    // Затем по интервалу
    this.intervalId = setInterval(async () => {
      await this.syncActiveConversations().catch((error) => {
        logger.error('Error in periodic sync:', error);
      });
    }, this.pollingInterval);
  }

  /**
   * Остановить polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('UmnicoRealtimeSync stopped');
  }

  /**
   * Синхронизация активных диалогов
   */
  private async syncActiveConversations(): Promise<void> {
    const sql = getSqlConnection();

    try {
      // Получаем активные чаты (сессия не истекла)
      const activeConversations = await sql`
        SELECT 
          umnico_conversation_id, 
          last_message_at,
          client_id
        FROM conversations
        WHERE session_expires_at > NOW()
        AND status = 'active'
        AND umnico_conversation_id IS NOT NULL
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 20
      `;

      if (activeConversations.length === 0) {
        logger.debug('No active conversations to sync');
        return;
      }

      logger.debug(`Syncing ${activeConversations.length} active conversations`);

      // Для каждого чата проверяем новые сообщения
      for (const conv of activeConversations) {
        try {
          const lastSync = conv.last_message_at 
            ? new Date(conv.last_message_at)
            : new Date(Date.now() - 24 * 60 * 60 * 1000); // За последние 24 часа если нет last_message_at

          // Получаем новые сообщения через Playwright Service
          const newMessages = await this.getNewMessagesFromPlaywright(
            conv.umnico_conversation_id,
            lastSync
          );

          // Обрабатываем каждое новое сообщение
          if (newMessages.length > 0) {
            logger.info(
              `Found ${newMessages.length} new messages in conversation ${conv.umnico_conversation_id}`
            );

            // Обрабатываем сообщения в порядке времени (старые первыми)
            const sortedMessages = newMessages.sort((a, b) => {
              const dateA = a.datetime ? new Date(a.datetime).getTime() : 0;
              const dateB = b.datetime ? new Date(b.datetime).getTime() : 0;
              return dateA - dateB;
            });

            for (const message of sortedMessages) {
              try {
                await this.bridge.handleNewMessage(conv.umnico_conversation_id, message);
              } catch (error) {
                logger.error(
                  `Failed to handle message in conversation ${conv.umnico_conversation_id}:`,
                  error
                );
                // Продолжаем со следующим сообщением
              }
            }

            // Обновляем last_message_at только если обработка прошла успешно
            const lastMessageTime = sortedMessages[sortedMessages.length - 1]?.datetime;
            if (lastMessageTime) {
              try {
                const lastMsgDate = new Date(lastMessageTime);
                if (!isNaN(lastMsgDate.getTime())) {
                  await sql`
                    UPDATE conversations
                    SET last_message_at = ${lastMsgDate}
                    WHERE umnico_conversation_id = ${conv.umnico_conversation_id}
                  `;
                } else {
                  await sql`
                    UPDATE conversations
                    SET last_message_at = NOW()
                    WHERE umnico_conversation_id = ${conv.umnico_conversation_id}
                  `;
                }
              } catch (error) {
                logger.warn(`Failed to update last_message_at: ${error}`);
              }
            }
          }
        } catch (error) {
          logger.error(
            `Failed to sync conversation ${conv.umnico_conversation_id}:`,
            error
          );
          // Продолжаем с следующим чатом
        }
      }
    } catch (error) {
      logger.error('Error in syncActiveConversations:', error);
      throw error;
    }
  }

  /**
   * Получить новые сообщения через Playwright Service
   */
  private async getNewMessagesFromPlaywright(
    conversationId: string,
    since: Date
  ): Promise<any[]> {
    try {
      const url = `${PLAYWRIGHT_SERVICE_URL}/api/conversations/${conversationId}/messages?since=${since.toISOString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Playwright Service error: ${response.status} ${errorText}`
        );
      }

      const data: any = await response.json();

      if (!data.ok) {
        throw new Error(`Playwright Service returned error: ${data.error || 'Unknown error'}`);
      }

      return data.data || [];
    } catch (error) {
      logger.error(
        `Failed to get new messages from Playwright Service for conversation ${conversationId}:`,
        error
      );
      // Возвращаем пустой массив вместо throw, чтобы не прерывать синхронизацию других чатов
      return [];
    }
  }

  /**
   * Получить статус синхронизации
   */
  getStatus(): {
    isRunning: boolean;
    pollingInterval: number;
    lastSyncAt?: Date;
  } {
    return {
      isRunning: this.isRunning,
      pollingInterval: this.pollingInterval,
    };
  }
}

