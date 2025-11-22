#!/usr/bin/env node
import 'dotenv/config';

const REPO = '33pok/geodrive_n8n-agents';
const GITHUB_API = `https://api.github.com/repos/${REPO}/actions/runs`;

// Получаем токен из переменных окружения или используем без авторизации для публичных репозиториев
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function checkCIStatus() {
  try {
    console.log('🔍 Проверка статуса CI...\n');
    
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'CI-Status-Checker'
    };
    
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${GITHUB_API}?per_page=1&branch=master`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const latestRun = data.workflow_runs?.[0];

    if (!latestRun) {
      console.log('❌ Не найдено запусков CI');
      return;
    }

    const status = latestRun.status; // queued, in_progress, completed
    const conclusion = latestRun.conclusion; // success, failure, cancelled, null
    const workflowName = latestRun.name || 'CI';
    const commitSha = latestRun.head_sha?.substring(0, 7);
    const commitMessage = latestRun.head_commit?.message?.split('\n')[0] || 'N/A';
    const htmlUrl = latestRun.html_url;
    const createdAt = new Date(latestRun.created_at).toLocaleString('ru-RU');

    console.log(`📋 Workflow: ${workflowName}`);
    console.log(`📝 Коммит: ${commitSha} - ${commitMessage}`);
    console.log(`🕐 Создан: ${createdAt}`);
    console.log(`📊 Статус: ${status}`);
    
    if (conclusion) {
      const emoji = conclusion === 'success' ? '✅' : conclusion === 'failure' ? '❌' : '⚠️';
      console.log(`${emoji} Результат: ${conclusion}`);
    } else {
      console.log(`⏳ Результат: выполняется...`);
    }

    console.log(`🔗 Ссылка: ${htmlUrl}\n`);

    // Проверяем jobs
    if (latestRun.id) {
      const jobsResponse = await fetch(`${GITHUB_API}/${latestRun.id}/jobs`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'CI-Status-Checker'
        }
      });

      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        const jobs = jobsData.jobs || [];

        if (jobs.length > 0) {
          console.log('📦 Jobs:');
          for (const job of jobs) {
            const jobEmoji = job.conclusion === 'success' ? '✅' : 
                           job.conclusion === 'failure' ? '❌' : 
                           job.status === 'in_progress' ? '⏳' : '⚠️';
            console.log(`  ${jobEmoji} ${job.name}: ${job.status} ${job.conclusion ? `(${job.conclusion})` : ''}`);
          }
          console.log('');
        }
      }
    }

    // Итоговый статус
    if (status === 'completed' && conclusion === 'success') {
      console.log('✅ CI успешно завершен!');
      process.exit(0);
    } else if (status === 'completed' && conclusion === 'failure') {
      console.log('❌ CI завершился с ошибкой');
      process.exit(1);
    } else {
      console.log('⏳ CI еще выполняется...');
      process.exit(2); // Код 2 = in progress
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке CI:', error.message);
    process.exit(1);
  }
}

checkCIStatus();

