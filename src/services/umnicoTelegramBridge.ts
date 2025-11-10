/**
 * Umnico Telegram Bridge
 * 
 * Создание тем в Telegram для диалогов Umnico, управление сессиями,
 * отправка сообщений в темы и синхронизация с Umnico
 */

import { Telegraf } from 'telegraf';
import { getBot } from '../bot/index.js';
import { getSqlConnection } from '../db/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface ConversationTopic {
  conversationId: string;
  tgChatId: number;
  tgTopicId: number;
  clientName: string;
  carInfo?: string;
  bookingDates?: string;
  lastActivityAt: Date;
  sessionExpiresAt: Date;
  assignedEmployeeId?: string;
}

interface ClientInfo {
  clientId: string;
  name: string;
  phone: string;
}

interface BookingInfo {
  bookingId?: string;
  carName?: string;
  dates?: string;
  responsibleEmployeeId?: string;
}

export class UmnicoTelegramBridge {
  private activeSessions = new Map<string, NodeJS.Timeout>();
  private bot: Telegraf;

  constructor() {
    this.bot = getBot();
  }

  /**
   * Обработать новое сообщение из Umnico
   */
  async handleNewMessage(conversationId: string, message: any): Promise<void> {
    try {
      logger.debug(`Handling new message for conversation ${conversationId}`);

      // 1. Получаем или создаем тему
      const topic = await this.getOrCreateTopic(conversationId, message);

      // 2. Отправляем сообщение в тему
      await this.sendMessageToTopic(topic, message);

      // 3. Обновляем таймер сессии (1 час с момента последнего сообщения)
      this.updateSessionTimer(conversationId, topic);
    } catch (error) {
      logger.error(`Failed to handle new message for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Создать или получить тему для диалога
   */
  async getOrCreateTopic(
    conversationId: string,
    message: any
  ): Promise<ConversationTopic> {
    const sql = getSqlConnection();

    // Проверяем в БД
    const existing = await sql`
      SELECT 
        tg_chat_id, 
        tg_topic_id, 
        client_name, 
        car_info, 
        booking_dates,
        session_expires_at,
        assigned_employee_id
      FROM conversations
      WHERE umnico_conversation_id = ${conversationId}
      AND tg_topic_id IS NOT NULL
    `;

    if (existing.length > 0 && existing[0].tg_topic_id) {
      return {
        conversationId,
        tgChatId: Number(existing[0].tg_chat_id),
        tgTopicId: Number(existing[0].tg_topic_id),
        clientName: existing[0].client_name || 'Unknown',
        carInfo: existing[0].car_info || undefined,
        bookingDates: existing[0].booking_dates || undefined,
        lastActivityAt: new Date(),
        sessionExpiresAt: existing[0].session_expires_at 
          ? new Date(existing[0].session_expires_at)
          : new Date(Date.now() + 60 * 60 * 1000),
        assignedEmployeeId: existing[0].assigned_employee_id || undefined,
      };
    }

    // Создаем новую тему
    return await this.createNewTopic(conversationId, message);
  }

  /**
   * Создать новую тему в Telegram форуме
   */
  async createNewTopic(
    conversationId: string,
    message: any
  ): Promise<ConversationTopic> {
    const sql = getSqlConnection();

    if (!config.umnicoForumChatId) {
      throw new Error('UMNICO_FORUM_CHAT_ID not configured');
    }

    const forumChatId = parseInt(config.umnicoForumChatId);
    if (isNaN(forumChatId)) {
      throw new Error(`Invalid UMNICO_FORUM_CHAT_ID: ${config.umnicoForumChatId}`);
    }

    logger.info(`Creating new topic for conversation ${conversationId}`);

    // Получаем информацию о клиенте и брони
    const clientPhone = message.client_phone || message.from || message.phone || '';
    const clientInfo = await this.getClientInfo(clientPhone);
    
    // Получаем информацию о брони только если есть clientId
    const bookingInfo = clientInfo.clientId 
      ? await this.getBookingInfo(clientInfo.clientId)
      : {};

    // Формируем название темы
    const topicName = this.formatTopicName(
      clientInfo.name,
      bookingInfo.carName,
      bookingInfo.dates
    );

    // Создаем тему через Bot API
    // Используем прямой вызов Telegram Bot API, так как Telegraf может не иметь этого метода
    const botToken = process.env.N8N_ALERTS_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('Telegram bot token not found');
    }

    const createTopicResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/createForumTopic`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: forumChatId,
          name: topicName,
          icon_color: 0x6FB9F0, // Синий цвет
        }),
      }
    );

    if (!createTopicResponse.ok) {
      const error = await createTopicResponse.json();
      throw new Error(`Failed to create forum topic: ${JSON.stringify(error)}`);
    }

    const topicData: any = await createTopicResponse.json();
    if (!topicData.ok) {
      throw new Error(`Telegram API error: ${topicData.description || 'Unknown error'}`);
    }

    const topic = topicData.result;

    logger.info(`Created topic ${topic.message_thread_id} for conversation ${conversationId}`);

    // Создаем закрепленное сообщение с информацией
    const pinnedMessage = await this.createPinnedMessage(
      forumChatId,
      topic.message_thread_id,
      clientInfo,
      bookingInfo,
      conversationId
    );

    // Закрепляем сообщение
    try {
      await this.bot.telegram.pinChatMessage(
        forumChatId,
        pinnedMessage.message_id,
        { message_thread_id: topic.message_thread_id } as any
      );
    } catch (error) {
      logger.warn(`Failed to pin message: ${error}`);
      // Не критично, продолжаем
    }

    // Сохраняем в БД
    const sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1 час
    await sql`
      UPDATE conversations
      SET 
        tg_chat_id = ${forumChatId},
        tg_topic_id = ${topic.message_thread_id},
        client_name = ${clientInfo.name},
        car_info = ${bookingInfo.carName || null},
        booking_dates = ${bookingInfo.dates || null},
        session_expires_at = ${sessionExpiresAt},
        assigned_employee_id = ${bookingInfo.responsibleEmployeeId || null}
      WHERE umnico_conversation_id = ${conversationId}
    `;

    return {
      conversationId,
      tgChatId: forumChatId,
      tgTopicId: topic.message_thread_id,
      clientName: clientInfo.name,
      carInfo: bookingInfo.carName,
      bookingDates: bookingInfo.dates,
      lastActivityAt: new Date(),
      sessionExpiresAt,
      assignedEmployeeId: bookingInfo.responsibleEmployeeId,
    };
  }

  /**
   * Форматировать название темы
   */
  private formatTopicName(
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

    // Ограничение длины (64 символа для Telegram)
    return name.substring(0, 64);
  }

  /**
   * Создать закрепленное сообщение с информацией
   */
  private async createPinnedMessage(
    chatId: number,
    topicId: number,
    clientInfo: ClientInfo,
    bookingInfo: BookingInfo,
    conversationId: string
  ): Promise<any> {
    const webUrl = config.webAppUrl 
      ? `${config.webAppUrl}/conversations/index.html?id=${conversationId}`
      : `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}`;

    // Формируем текст сообщения
    const messageText = this.formatPinnedMessage(
      clientInfo,
      bookingInfo,
      conversationId,
      webUrl
    );

    // Создаем inline-кнопки
    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: '❌ Закрыть диалог', 
            callback_data: `close_dialog_${conversationId}` 
          },
          { 
            text: '⏰ Продлить на 1 час', 
            callback_data: `extend_dialog_${conversationId}` 
          }
        ],
        [
          { 
            text: '📋 Открыть в Umnico', 
            url: `https://umnico.com/app/inbox/deals/inbox/details/${conversationId}` 
          }
        ]
      ]
    };

    return await this.bot.telegram.sendMessage(chatId, messageText, {
      message_thread_id: topicId,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  /**
   * Форматировать закрепленное сообщение
   */
  private formatPinnedMessage(
    clientInfo: ClientInfo,
    bookingInfo: BookingInfo,
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

  /**
   * Отправить сообщение в тему
   */
  async sendMessageToTopic(topic: ConversationTopic, message: any): Promise<void> {
    const text = message.direction === 'incoming'
      ? `👤 <b>${topic.clientName}:</b>\n${message.text || ''}`
      : `💬 <b>Ответ:</b>\n${message.text || ''}`;

    await this.bot.telegram.sendMessage(topic.tgChatId, text, {
      message_thread_id: topic.tgTopicId,
      parse_mode: 'HTML',
    });
  }

  /**
   * Получить информацию о клиенте по телефону (создать если не найден)
   */
  private async getClientInfo(phone: string): Promise<ClientInfo> {
    const sql = getSqlConnection();

    if (!phone || phone.trim().length === 0) {
      logger.warn('Empty phone number provided to getClientInfo');
      return {
        clientId: '',
        name: 'Unknown',
        phone: '',
      };
    }

    // Нормализуем телефон (убираем все кроме цифр и +)
    const normalizedPhone = phone.trim().replace(/[^\d+]/g, '');

    // Ищем существующего клиента по точному совпадению или частичному
    const result = await sql`
      SELECT id, name, phone
      FROM clients
      WHERE phone = ${normalizedPhone}
      OR phone = ${phone.trim()}
      OR phone LIKE ${'%' + normalizedPhone.replace(/\+/g, '') + '%'}
      LIMIT 1
    `;

    if (result.length > 0) {
      return {
        clientId: result[0].id,
        name: result[0].name || phone.trim(),
        phone: result[0].phone || phone.trim(),
      };
    }

    // Если клиент не найден, создаем нового
    try {
      const [newClient] = await sql`
        INSERT INTO clients (id, phone, name, updated_at)
        VALUES (gen_random_uuid(), ${normalizedPhone}, ${phone.trim()}, now())
        RETURNING id, name, phone
      `;

      logger.info(`Created new client ${newClient.id} for phone ${normalizedPhone}`);
      return {
        clientId: newClient.id,
        name: newClient.name || phone.trim(),
        phone: newClient.phone || normalizedPhone,
      };
    } catch (error) {
      logger.error(`Failed to create client for phone ${phone}:`, error);
      // Возвращаем базовую информацию без clientId
      return {
        clientId: '',
        name: phone.trim(),
        phone: normalizedPhone,
      };
    }
  }

  /**
   * Получить информацию о брони
   */
  private async getBookingInfo(clientId: string): Promise<BookingInfo> {
    if (!clientId) {
      return {};
    }

    const sql = getSqlConnection();

    // Ищем активную или последнюю бронь
    const result = await sql`
      SELECT 
        b.id,
        b.start_at,
        b.end_at,
        b.responsible_id,
        c.model,
        c.plate
      FROM bookings b
      LEFT JOIN cars c ON b.car_id = c.id
      WHERE b.client_id = ${clientId}
      AND b.status IN ('planned', 'active')
      ORDER BY b.start_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      // Пробуем найти последнюю завершенную бронь
      const lastBooking = await sql`
        SELECT 
          b.id,
          b.start_at,
          b.end_at,
          b.responsible_id,
          c.model,
          c.plate
        FROM bookings b
        LEFT JOIN cars c ON b.car_id = c.id
        WHERE b.client_id = ${clientId}
        ORDER BY b.end_at DESC NULLS LAST, b.start_at DESC
        LIMIT 1
      `;

      if (lastBooking.length > 0) {
        return this.formatBookingInfo(lastBooking[0]);
      }

      return {};
    }

    return this.formatBookingInfo(result[0]);
  }

  /**
   * Форматировать информацию о брони
   */
  private formatBookingInfo(booking: any): BookingInfo {
    const carName = booking.model 
      ? `${booking.model}${booking.plate ? ` (${booking.plate})` : ''}`
      : undefined;

    let dates: string | undefined;
    if (booking.start_at && booking.end_at) {
      try {
        const start = new Date(booking.start_at);
        const end = new Date(booking.end_at);
        
        // Форматируем даты: DD.MM-DD.MM
        const startDay = String(start.getDate()).padStart(2, '0');
        const startMonth = String(start.getMonth() + 1).padStart(2, '0');
        const endDay = String(end.getDate()).padStart(2, '0');
        const endMonth = String(end.getMonth() + 1).padStart(2, '0');
        
        dates = `${startDay}.${startMonth}-${endDay}.${endMonth}`;
      } catch (error) {
        logger.warn(`Failed to format booking dates: ${error}`);
      }
    }

    return {
      bookingId: booking.id,
      carName,
      dates,
      responsibleEmployeeId: booking.responsible_id,
    };
  }

  /**
   * Обновить таймер сессии
   */
  private updateSessionTimer(conversationId: string, topic: ConversationTopic): void {
    // Очищаем старый таймер
    const oldTimer = this.activeSessions.get(conversationId);
    if (oldTimer) {
      clearTimeout(oldTimer);
    }

    // Создаем новый таймер (1 час)
    const timer = setTimeout(async () => {
      await this.closeSession(conversationId);
    }, 60 * 60 * 1000);

    this.activeSessions.set(conversationId, timer);
    logger.debug(`Updated session timer for conversation ${conversationId}`);
  }

  /**
   * Закрыть сессию (архивировать тему)
   */
  async closeSession(conversationId: string): Promise<void> {
    const sql = getSqlConnection();

    const topic = await sql`
      SELECT tg_chat_id, tg_topic_id
      FROM conversations
      WHERE umnico_conversation_id = ${conversationId}
    `;

    if (topic.length === 0 || !topic[0].tg_topic_id) {
      logger.warn(`No topic found for conversation ${conversationId}`);
      return;
    }

    try {
      // Отправляем сообщение о закрытии
      await this.bot.telegram.sendMessage(
        Number(topic[0].tg_chat_id),
        '⏰ <b>Сессия закрыта</b>\nДиалог автоматически закрыт по истечении времени ожидания.',
        {
          message_thread_id: Number(topic[0].tg_topic_id),
          parse_mode: 'HTML',
        }
      );
    } catch (error) {
      logger.warn(`Failed to send close message: ${error}`);
    }

    // Обновляем статус в БД
    await sql`
      UPDATE conversations
      SET session_expires_at = NULL, status = 'closed'
      WHERE umnico_conversation_id = ${conversationId}
    `;

    // Удаляем таймер
    this.activeSessions.delete(conversationId);
    logger.info(`Closed session for conversation ${conversationId}`);
  }

  /**
   * Продлить сессию на 1 час
   */
  async extendSession(conversationId: string): Promise<void> {
    const sql = getSqlConnection();
    const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await sql`
      UPDATE conversations
      SET session_expires_at = ${newExpiresAt}
      WHERE umnico_conversation_id = ${conversationId}
    `;

    // Обновляем таймер
    const topic = await this.getOrCreateTopic(conversationId, {});
    this.updateSessionTimer(conversationId, topic);

    logger.info(`Extended session for conversation ${conversationId}`);
  }
}

