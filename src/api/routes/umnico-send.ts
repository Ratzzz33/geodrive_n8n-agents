/**
 * API endpoint для отправки сообщений в Umnico
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import { getSqlConnection } from '../../db/index.js';

const router = Router();
const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_UMNICO_URL || 'http://localhost:3001';

/**
 * POST /api/umnico/send
 * Отправить сообщение клиенту через Umnico
 * 
 * Body: {
 *   conversationId: string,
 *   text: string
 * }
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { conversationId, text } = req.body;

    // Валидация
    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'conversationId is required and must be a string',
      });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'text is required and must be a non-empty string',
      });
    }

    logger.info(`Sending message to Umnico conversation ${conversationId}`);

    // Отправляем через Playwright Service
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
      logger.error(`Playwright Service error: ${response.status} ${errorText}`);
      return res.status(500).json({
        ok: false,
        error: `Failed to send message: ${errorText}`,
      });
    }

    const data: any = await response.json();

    if (!data.ok) {
      return res.status(500).json({
        ok: false,
        error: data.error || 'Unknown error from Playwright Service',
      });
    }

    // Сохраняем сообщение в БД
    const sql = getSqlConnection();
    try {
      const conv = await sql`
        SELECT client_id, id as conversation_uuid
        FROM conversations
        WHERE umnico_conversation_id = ${conversationId}
        LIMIT 1
      `;

      if (conv.length > 0) {
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
            ${JSON.stringify({ source: 'api' })}
          )
        `;
      }
    } catch (dbError) {
      logger.warn(`Failed to save message to DB: ${dbError}`);
      // Не критично, продолжаем
    }

    res.json({
      ok: true,
      conversationId,
      message: 'Message sent successfully',
    });
  } catch (error) {
    logger.error('Error in /api/umnico/send:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

