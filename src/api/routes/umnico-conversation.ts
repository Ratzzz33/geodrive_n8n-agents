/**
 * API endpoint для получения истории диалога Umnico
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import { getSqlConnection } from '../../db/index.js';

const router = Router();

/**
 * GET /api/umnico/conversations/:id
 * Получить историю диалога с клиентом
 * 
 * Query params:
 *   - limit: количество сообщений (default: 50, max: 200)
 *   - offset: смещение для пагинации (default: 0)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!conversationId) {
      return res.status(400).json({
        ok: false,
        error: 'conversationId is required',
      });
    }

    const sql = getSqlConnection();

    // Получаем информацию о диалоге
    const conversation = await sql`
      SELECT 
        c.id,
        c.umnico_conversation_id,
        c.client_name,
        c.car_info,
        c.booking_dates,
        c.channel,
        c.status,
        c.created_at,
        c.last_message_at,
        cl.id as client_id,
        cl.name as client_name_full,
        cl.phone,
        cl.email
      FROM conversations c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.umnico_conversation_id = ${conversationId}
      LIMIT 1
    `;

    if (conversation.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Conversation not found',
      });
    }

    const conv = conversation[0];

    // Получаем сообщения
    const messages = await sql`
      SELECT 
        id,
        direction,
        channel,
        text,
        sent_at,
        read_at,
        metadata
      FROM messages
      WHERE conversation_id = ${conv.id}
      ORDER BY sent_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Получаем общее количество сообщений
    const totalResult = await sql`
      SELECT COUNT(*) as total
      FROM messages
      WHERE conversation_id = ${conv.id}
    `;
    const total = totalResult[0]?.total || 0;

    // Получаем информацию о брони (если есть)
    let bookingInfo = null;
    if (conv.client_id) {
      const booking = await sql`
        SELECT 
          b.id,
          b.start_at,
          b.end_at,
          b.status,
          c.model,
          c.plate
        FROM bookings b
        LEFT JOIN cars c ON b.car_id = c.id
        WHERE b.client_id = ${conv.client_id}
        AND b.status IN ('planned', 'active')
        ORDER BY b.start_at DESC
        LIMIT 1
      `;

      if (booking.length > 0) {
        bookingInfo = {
          id: booking[0].id,
          startAt: booking[0].start_at,
          endAt: booking[0].end_at,
          status: booking[0].status,
          car: booking[0].model 
            ? `${booking[0].model}${booking[0].plate ? ` (${booking[0].plate})` : ''}`
            : null,
        };
      }
    }

    res.json({
      ok: true,
      conversation: {
        id: conv.id,
        umnicoConversationId: conv.umnico_conversation_id,
        client: {
          id: conv.client_id,
          name: conv.client_name_full || conv.client_name,
          phone: conv.phone,
          email: conv.email,
        },
        carInfo: conv.car_info,
        bookingDates: conv.booking_dates,
        channel: conv.channel,
        status: conv.status,
        createdAt: conv.created_at,
        lastMessageAt: conv.last_message_at,
        booking: bookingInfo,
      },
      messages: messages.map(m => ({
        id: m.id,
        direction: m.direction,
        channel: m.channel,
        text: m.text,
        sentAt: m.sent_at,
        readAt: m.read_at,
        metadata: m.metadata,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Error in /api/umnico/conversations/:id:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

