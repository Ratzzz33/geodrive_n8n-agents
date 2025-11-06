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
 * POST /scrape-company-cash
 * Парсинг кассы компании
 */
app.post('/scrape-company-cash', async (req, res) => {
  const { branch } = req.body;
  
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
});

/**
 * POST /scrape-events
 * Парсинг страницы событий
 */
app.post('/scrape-events', async (req, res) => {
  const { branch } = req.body;
  
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
});

/**
 * POST /scrape-employee-cash
 * Парсинг кассы конкретного сотрудника
 */
app.post('/scrape-employee-cash', async (req, res) => {
  const { branch, employeeName } = req.body;
  
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
});

const PORT = 3002;  // Другой порт чтобы не конфликтовать с Playwright service

app.listen(PORT, () => {
  console.log(`🚀 HTTP Scraper Service listening on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Method: HTTP requests (no Playwright/browser)`);
  console.log(`   Memory: ~20MB (vs ~300MB for Playwright)`);
});

