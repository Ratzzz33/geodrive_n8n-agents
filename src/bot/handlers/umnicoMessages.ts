/**
 * Обработка сообщений в темах Umnico диалогов
 * 
 * Определяет сообщения в темах и отправляет их клиентам через Umnico
 */

import { Context } from 'telegraf';
import { logger } from '../../utils/logger.js';
import { getSqlConnection } from '../../db/index.js';
import { config } from '../../config/index.js';

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';

/**
 * Обработать сообщение в теме Umnico диалога
 */
export async function handleUmnicoTopicMessage(ctx: Context): Promise<void> {
  try {
    // Проверяем что сообщение в теме (message_thread_id существует)
    if (!ctx.message || !('message_thread_id' in ctx.message)) {
      return; // Не тема, игнорируем
    }

    const messageThreadId = ctx.message.message_thread_id;
    const chatId = ctx.chat?.id;

    if (!chatId || !messageThreadId) {
      return;
    }

    // Проверяем что это наш форум Umnico
    const forumChatId = config.umnicoForumChatId 
      ? parseInt(config.umnicoForumChatId)
      : null;

    if (!forumChatId || chatId !== forumChatId) {
      return; // Не наш форум
    }

    // Получаем текст сообщения
    const text = 'text' in ctx.message ? ctx.message.text : '';
    if (!text || text.trim().length === 0) {
      return; // Пустое сообщение
    }

    // Игнорируем команды
    if (text.startsWith('/')) {
      return;
    }

    // Находим conversation по tg_topic_id
    const sql = getSqlConnection();
    const conversation = await sql`
      SELECT umnico_conversation_id
      FROM conversations
      WHERE tg_chat_id = ${chatId}
      AND tg_topic_id = ${messageThreadId}
      AND status = 'active'
      LIMIT 1
    `;

    if (conversation.length === 0 || !conversation[0].umnico_conversation_id) {
      logger.debug(`No active conversation found for topic ${messageThreadId}`);
      return; // Тема не связана с активным диалогом
    }

    const conversationId = conversation[0].umnico_conversation_id;

    logger.info(
      `Sending message to Umnico conversation ${conversationId} from Telegram topic ${messageThreadId}`
    );

    // Отправляем сообщение через Playwright Service
    await sendMessageToUmnico(conversationId, text);

    // Сохраняем сообщение в БД как outgoing
    await saveOutgoingMessage(conversationId, text, ctx.from?.id);

    // Продлеваем сессию при отправке сообщения
    try {
      const { UmnicoTelegramBridge } = await import('../../services/umnicoTelegramBridge.js');
      const bridge = new UmnicoTelegramBridge();
      await bridge.extendSession(conversationId);
    } catch (error) {
      logger.warn(`Failed to extend session for conversation ${conversationId}:`, error);
      // Не критично, продолжаем
    }

    logger.info(`Message sent successfully to conversation ${conversationId}`);
  } catch (error) {
    logger.error('Error handling Umnico topic message:', error);
    // Не отвечаем пользователю, чтобы не спамить
  }
}

/**
 * Отправить сообщение в Umnico через Playwright Service
 */
async function sendMessageToUmnico(conversationId: string, text: string): Promise<void> {
  try {
    const url = `${PLAYWRIGHT_SERVICE_URL}/api/conversations/${conversationId}/send`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
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
  } catch (error) {
    logger.error(`Failed to send message to Umnico conversation ${conversationId}:`, error);
    throw error;
  }
}

/**
 * Сохранить исходящее сообщение в БД
 */
async function saveOutgoingMessage(
  conversationId: string,
  text: string,
  telegramUserId?: number
): Promise<void> {
  const sql = getSqlConnection();

  try {
    // Получаем client_id из conversation
    const conv = await sql`
      SELECT client_id, id as conversation_uuid
      FROM conversations
      WHERE umnico_conversation_id = ${conversationId}
      LIMIT 1
    `;

    if (conv.length === 0) {
      logger.warn(`Conversation ${conversationId} not found in DB`);
      return;
    }

    // Сохраняем сообщение
    await sql`
      INSERT INTO messages (
        client_id,
        conversation_id,
        direction,
        channel,
        text,
        sent_at,
        metadata
      )
      VALUES (
        ${conv[0].client_id},
        ${conv[0].conversation_uuid},
        'outgoing',
        'whatsapp',
        ${text},
        NOW(),
        ${JSON.stringify({ telegram_user_id: telegramUserId, source: 'telegram_topic' })}
      )
    `;
  } catch (error) {
    logger.error(`Failed to save outgoing message:`, error);
    // Не критично, продолжаем
  }
}

