/**
 * HTTP Scraper Service - легкая альтернатива Playwright
 * Использует обычные HTTP запросы вместо полноценного браузера
 */

import express from 'express';
import {
  scrapeCompanyCash,
  scrapeEvents,
  scrapeEmployeeCash,
} from './rentprogScraper.js';

const app = express();
app.use(express.json());

type Branch = 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center';

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'http-scraper-service',
    method: 'HTTP requests (no browser)'
  });
});

/**
 * Парсинг кассы компании
 * POST /scrape-company-cash (body: {branch})
 * GET /scrape-company-cash?branch=tbilisi
 */
const scrapeCompanyCashHandler = async (req: any, res: any) => {
  const branch = req.body?.branch || req.query?.branch;
  
  if (!branch || !['tbilisi', 'batumi', 'kutaisi', 'service-center'].includes(branch)) {
    return res.status(400).json({
      success: false,
      error: `Invalid branch: ${branch}`
    });
  }
  
  console.log(`📥 Request: scrape-company-cash for ${branch}`);
  
  try {
    const result = await scrapeCompanyCash(branch as Branch);
    res.json(result);
  } catch (error) {
    console.error(`❌ Error scraping company cash:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

app.post('/scrape-company-cash', scrapeCompanyCashHandler);
app.get('/scrape-company-cash', scrapeCompanyCashHandler);

/**
 * Парсинг страницы событий
 * POST /scrape-events (body: {branch})
 * GET /scrape-events?branch=tbilisi
 */
const scrapeEventsHandler = async (req: any, res: any) => {
  const branch = req.body?.branch || req.query?.branch;
  
  if (!branch || !['tbilisi', 'batumi', 'kutaisi', 'service-center'].includes(branch)) {
    return res.status(400).json({
      success: false,
      error: `Invalid branch: ${branch}`
    });
  }
  
  console.log(`📥 Request: scrape-events for ${branch}`);
  
  try {
    const result = await scrapeEvents(branch as Branch);
    res.json(result);
  } catch (error) {
    console.error(`❌ Error scraping events:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

app.post('/scrape-events', scrapeEventsHandler);
app.get('/scrape-events', scrapeEventsHandler);

/**
 * Парсинг кассы конкретного сотрудника
 * POST /scrape-employee-cash (body: {branch, employeeName})
 * GET /scrape-employee-cash?branch=tbilisi&employeeName=agent1
 */
const scrapeEmployeeCashHandler = async (req: any, res: any) => {
  const branch = req.body?.branch || req.query?.branch;
  const employeeName = req.body?.employeeName || req.query?.employeeName;
  
  if (!branch || !['tbilisi', 'batumi', 'kutaisi', 'service-center'].includes(branch)) {
    return res.status(400).json({
      success: false,
      error: `Invalid branch: ${branch}`
    });
  }
  
  if (!employeeName) {
    return res.status(400).json({
      success: false,
      error: 'employeeName is required'
    });
  }
  
  console.log(`📥 Request: scrape-employee-cash for ${employeeName} in ${branch}`);
  
  try {
    const result = await scrapeEmployeeCash(branch as Branch, employeeName);
    res.json(result);
  } catch (error) {
    console.error(`❌ Error scraping employee cash:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

app.post('/scrape-employee-cash', scrapeEmployeeCashHandler);
app.get('/scrape-employee-cash', scrapeEmployeeCashHandler);

const PORT = 3002;  // Другой порт чтобы не конфликтовать с Playwright service

app.listen(PORT, () => {
  console.log(`🚀 HTTP Scraper Service listening on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Method: HTTP requests (no Playwright/browser)`);
  console.log(`   Memory: ~20MB (vs ~300MB for Playwright)`);
});

