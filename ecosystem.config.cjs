module.exports = {
  apps: [
    {
      name: 'jarvis-api',
      script: './dist/api/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DISPLAY: ':99'  // Виртуальный X сервер для Playwright non-headless
      },
      error_file: './logs/jarvis-api-error.log',
      out_file: './logs/jarvis-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'playwright-service',
      script: './dist/services/playwrightService.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PLAYWRIGHT_PORT: 3001
      },
      error_file: './logs/playwright-service-error.log',
      out_file: './logs/playwright-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'http-scraper-service',
      script: './dist/services/httpScraperService.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HTTP_SCRAPER_PORT: 3002
      },
      error_file: './logs/http-scraper-service-error.log',
      out_file: './logs/http-scraper-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};

