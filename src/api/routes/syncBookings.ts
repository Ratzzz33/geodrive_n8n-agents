/**
 * Endpoint для синхронизации бронирований из RentProg
 * Получает активные и неактивные бронирования из всех филиалов, сверяет с БД и обновляет
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import { paginate } from '../../integrations/rentprog.js';
import { upsertBookingFromRentProg } from '../../db/upsert.js';
import type { BranchName } from '../../integrations/rentprog.js';

const router = Router();

interface BookingSyncResult {
  branch: BranchName;
  total: number;
  created: number;
  updated: number;
  errors: number;
  errorMessages?: string[];
}

interface SyncReport {
  success: boolean;
  timestamp: string;
  summary: {
    total_bookings: number;
    total_created: number;
    total_updated: number;
    total_errors: number;
  };
  per_branch: BookingSyncResult[];
}

/**
 * POST /sync-bookings
 * Синхронизация бронирований из всех филиалов RentProg
 */
router.post('/sync-bookings', async (req, res) => {
  try {
    logger.info('[Sync Bookings] Starting bookings synchronization...');
    
    const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    const results: BookingSyncResult[] = [];
    
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalBookings = 0;
    
    // Обрабатываем каждый филиал последовательно (чтобы не перегружать API)
    for (const branch of branches) {
      logger.info(`[Sync Bookings] Processing branch: ${branch}...`);
      
      const branchResult: BookingSyncResult = {
        branch,
        total: 0,
        created: 0,
        updated: 0,
        errors: 0,
        errorMessages: []
      };
      
      try {
        // Получаем все бронирования из RentProg (активные и неактивные, без архивных)
        // Используем пагинацию через функцию paginate
        const bookings = await paginate<any>(branch, '/all_bookings', {
          // Параметры пагинации обрабатываются внутри paginate
        });
        
        branchResult.total = bookings.length;
        totalBookings += bookings.length;
        
        logger.info(`[Sync Bookings] ${branch}: Fetched ${bookings.length} bookings from RentProg`);
        
        // Обрабатываем каждое бронирование
        for (let i = 0; i < bookings.length; i++) {
          const booking = bookings[i];
          
          try {
            // Upsert бронирования (создает или обновляет)
            const result = await upsertBookingFromRentProg(booking, branch);
            
            if (result.created) {
              branchResult.created++;
              totalCreated++;
            } else {
              branchResult.updated++;
              totalUpdated++;
            }
            
            // Логируем прогресс каждые 50 записей
            if ((i + 1) % 50 === 0) {
              logger.info(`[Sync Bookings] ${branch}: Processed ${i + 1}/${bookings.length} bookings`);
            }
            
          } catch (error) {
            branchResult.errors++;
            totalErrors++;
            
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const bookingId = booking?.id || booking?.booking_id || 'unknown';
            
            logger.error(`[Sync Bookings] ${branch}: Error processing booking ${bookingId}:`, errorMsg);
            
            if (branchResult.errorMessages && branchResult.errorMessages.length < 10) {
              branchResult.errorMessages.push(`Booking ${bookingId}: ${errorMsg}`);
            }
          }
        }
        
        logger.info(
          `[Sync Bookings] ${branch}: Completed - Total: ${branchResult.total}, ` +
          `Created: ${branchResult.created}, Updated: ${branchResult.updated}, Errors: ${branchResult.errors}`
        );
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[Sync Bookings] ${branch}: Failed to fetch bookings:`, errorMsg);
        
        branchResult.errors = branchResult.total || 1;
        totalErrors += branchResult.errors;
        
        if (branchResult.errorMessages) {
          branchResult.errorMessages.push(`Failed to fetch: ${errorMsg}`);
        }
      }
      
      results.push(branchResult);
    }
    
    // Формируем отчет
    const report: SyncReport = {
      success: totalErrors === 0,
      timestamp: new Date().toISOString(),
      summary: {
        total_bookings: totalBookings,
        total_created: totalCreated,
        total_updated: totalUpdated,
        total_errors: totalErrors,
      },
      per_branch: results,
    };
    
    logger.info(
      `[Sync Bookings] Completed: Total bookings: ${totalBookings}, ` +
      `Created: ${totalCreated}, Updated: ${totalUpdated}, Errors: ${totalErrors}`
    );
    
    res.json(report);
    
  } catch (error) {
    logger.error('[Sync Bookings] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

