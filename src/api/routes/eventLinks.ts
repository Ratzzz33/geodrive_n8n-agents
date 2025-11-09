/**
 * API Routes для управления связями между events, payments и history
 */

import { Router } from 'express';
import { linkPayment, linkEvent, getLinksForPayment, getLinksStats } from '../../db/eventLinks';
import type { BranchName } from '../../integrations/rentprog';

const router = Router();

/**
 * POST /event-links/payment/:paymentId
 * Связать платеж с events и history
 */
router.post('/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { branch, rpPaymentId, paymentDate, timeWindowSeconds = 300 } = req.body;

    if (!branch || !rpPaymentId || !paymentDate) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: branch, rpPaymentId, paymentDate',
      });
    }

    const result = await linkPayment(
      paymentId,
      branch as BranchName,
      Number(rpPaymentId),
      new Date(paymentDate),
      { timeWindowSeconds, autoCreate: true }
    );

    res.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    console.error('Error linking payment:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to link payment',
    });
  }
});

/**
 * POST /event-links/event/:eventId
 * Связать событие с payments и history
 */
router.post('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { branch, rpEntityId, entityType, eventTime, timeWindowSeconds = 300 } = req.body;

    if (!branch || !rpEntityId || !entityType || !eventTime) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: branch, rpEntityId, entityType, eventTime',
      });
    }

    const result = await linkEvent(
      Number(eventId),
      branch as BranchName,
      rpEntityId,
      entityType as 'payment' | 'car' | 'booking' | 'client',
      new Date(eventTime),
      { timeWindowSeconds, autoCreate: true }
    );

    res.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    console.error('Error linking event:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to link event',
    });
  }
});

/**
 * GET /event-links/payment/:paymentId
 * Получить все связи для платежа
 */
router.get('/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const links = await getLinksForPayment(paymentId);

    res.json({
      ok: true,
      links,
    });
  } catch (error: any) {
    console.error('Error getting payment links:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get payment links',
    });
  }
});

/**
 * GET /event-links/stats
 * Получить статистику связей
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getLinksStats();

    res.json({
      ok: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error getting links stats:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get links stats',
    });
  }
});

/**
 * GET /event-links/unlinked
 * Получить несвязанные записи (через SQL view)
 */
router.get('/unlinked', async (req, res) => {
  try {
    const { getDatabase } = await import('../../db');
    const { sql } = await import('drizzle-orm');
    const db = getDatabase();
    if (!db) {
      return res.status(500).json({
        ok: false,
        error: 'Database not available',
      });
    }

    const unlinked = await db.execute(sql`
      SELECT * FROM unlinked_records
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const rows = unlinked as any[];

    res.json({
      ok: true,
      unlinked: rows,
      count: rows.length,
    });
  } catch (error: any) {
    console.error('Error getting unlinked records:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get unlinked records',
    });
  }
});

export default router;

