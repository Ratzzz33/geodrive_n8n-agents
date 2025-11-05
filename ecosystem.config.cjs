module.exports = {
  apps: [
    {
      name: 'jarvis-api',
      script: './dist/api/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
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
    }
  ]
};

