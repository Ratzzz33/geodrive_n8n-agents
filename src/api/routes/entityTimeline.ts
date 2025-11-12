/**
 * API Routes для работы с entity_timeline
 */

import { Router } from 'express';
import {
  getTimelineForEntity,
  getTimelineForRelatedEntities,
  getTimelineStats,
  type TimelineEntityType,
  type TimelineSourceType,
} from '../../db/entityTimeline.js';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /entity-timeline/entity/:entityType/:entityId
 * Получить timeline для сущности
 */
router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const {
      limit = '100',
      offset = '0',
      eventTypes,
      sourceTypes,
      startDate,
      endDate,
    } = req.query;

    const options: any = {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    if (eventTypes) {
      options.eventTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    }

    if (sourceTypes) {
      options.sourceTypes = Array.isArray(sourceTypes) ? sourceTypes : [sourceTypes];
    }

    if (startDate) {
      options.startDate = new Date(startDate as string);
    }

    if (endDate) {
      options.endDate = new Date(endDate as string);
    }

    const timeline = await getTimelineForEntity(
      entityType as TimelineEntityType,
      entityId,
      options
    );

    res.json({
      ok: true,
      data: timeline,
      count: timeline.length,
    });
  } catch (error: any) {
    logger.error(`Error getting timeline for entity ${req.params.entityType}/${req.params.entityId}:`, error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /entity-timeline/related
 * Получить timeline для связанных сущностей
 * Body: { entities: [{ type: 'car', id: 'uuid' }, ...], limit?, offset?, startDate?, endDate? }
 */
router.post('/related', async (req, res) => {
  try {
    const { entities, limit = 100, offset = 0, startDate, endDate } = req.body;

    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid entities array',
      });
    }

    const timeline = await getTimelineForRelatedEntities(entities, {
      limit,
      offset,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.json({
      ok: true,
      data: timeline,
      count: timeline.length,
    });
  } catch (error: any) {
    logger.error('Error getting timeline for related entities:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /entity-timeline/stats
 * Получить статистику по timeline
 */
router.get('/stats', async (req, res) => {
  try {
    const { entityType, branchCode, startDate, endDate } = req.query;

    const options: any = {};
    if (entityType) options.entityType = entityType as TimelineEntityType;
    if (branchCode) options.branchCode = branchCode as string;
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);

    const stats = await getTimelineStats(options);

    res.json({
      ok: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error getting timeline stats:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;

