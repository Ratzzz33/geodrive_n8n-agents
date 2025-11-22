#!/usr/bin/env node
/**
 * Мониторинг статуса CI GitHub Actions
 * 
 * Для работы с приватным репозиторием нужен GitHub токен:
 * 1. Создайте Personal Access Token (PAT) в GitHub:
 *    Settings → Developer settings → Personal access tokens → Tokens (classic)
 *    Права: repo (для доступа к Actions)
 * 
 * 2. Установите токен в переменную окружения:
 *    export GITHUB_TOKEN=your_token_here
 *    или добавьте в .env файл: GITHUB_TOKEN=your_token_here
 */

import 'dotenv/config';

const REPO = '33pok/geodrive_n8n-agents';
const GITHUB_API = `https://api.github.com/repos/${REPO}/actions/runs`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!GITHUB_TOKEN) {
  console.log('⚠️  GitHub токен не найден!');
  console.log('');
  console.log('Для автоматической проверки CI нужен GitHub Personal Access Token.');
  console.log('Установите его в переменную окружения:');
  console.log('  export GITHUB_TOKEN=your_token_here');
  console.log('  или добавьте в .env: GITHUB_TOKEN=your_token_here');
  console.log('');
  console.log('📋 Проверьте статус вручную:');
  console.log(`   https://github.com/${REPO}/actions`);
  console.log('');
  console.log('Ожидаемый коммит: f0e8a8a - "feat: добавлена история GPS координат..."');
  console.log('');
  process.exit(0);
}

async function checkCIStatus() {
  try {
    const response = await fetch(`${GITHUB_API}?per_page=1&branch=master`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'CI-Monitor'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const latestRun = data.workflow_runs?.[0];

    if (!latestRun) {
      return { status: 'not_found' };
    }

    return {
      status: latestRun.status,
      conclusion: latestRun.conclusion,
      name: latestRun.name,
      commitSha: latestRun.head_sha?.substring(0, 7),
      commitMessage: latestRun.head_commit?.message?.split('\n')[0],
      htmlUrl: latestRun.html_url,
      createdAt: latestRun.created_at,
      id: latestRun.id
    };

  } catch (error) {
    throw error;
  }
}

async function getJobsStatus(runId) {
  try {
    const response = await fetch(`${GITHUB_API}/${runId}/jobs`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'CI-Monitor'
      }
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    return data.jobs || [];
  } catch {
    return [];
  }
}

async function monitor() {
  console.log('🔍 Мониторинг CI статуса...\n');
  console.log(`📋 Репозиторий: ${REPO}`);
  console.log(`🔗 Ссылка: https://github.com/${REPO}/actions\n`);
  
  let checkCount = 0;
  const maxChecks = 60; // 10 минут при интервале 10 сек
  const interval = 10000; // 10 секунд

  while (checkCount < maxChecks) {
    checkCount++;
    
    try {
      const result = await checkCIStatus();
      
      if (result.status === 'not_found') {
        console.log('⚠️  Не найдено запусков CI');
        break;
      }

      const status = result.status;
      const conclusion = result.conclusion;
      const time = new Date().toLocaleTimeString('ru-RU');
      
      console.log(`[${time}] Проверка #${checkCount}`);
      
      if (result.commitSha) {
        const isOurCommit = result.commitSha === 'f0e8a8a';
        const commitInfo = isOurCommit ? `✅ ${result.commitSha}` : result.commitSha;
        console.log(`   Коммит: ${commitInfo} - ${result.commitMessage || 'N/A'}`);
      }
      
      if (status === 'completed') {
        if (conclusion === 'success') {
          console.log('   ✅ CI успешно завершен!');
          
          if (result.id) {
            const jobs = await getJobsStatus(result.id);
            if (jobs.length > 0) {
              console.log('\n   📦 Jobs:');
              for (const job of jobs) {
                const emoji = job.conclusion === 'success' ? '✅' : '❌';
                console.log(`      ${emoji} ${job.name}: ${job.conclusion || job.status}`);
              }
            }
          }
          
          console.log(`\n   🔗 ${result.htmlUrl}\n`);
          console.log('🎉 CI зеленый! Задача выполнена.\n');
          process.exit(0);
        } else if (conclusion === 'failure') {
          console.log('   ❌ CI завершился с ошибкой');
          console.log(`   🔗 ${result.htmlUrl}\n`);
          process.exit(1);
        } else {
          console.log(`   ⚠️  CI завершен со статусом: ${conclusion}`);
        }
        break;
      } else if (status === 'in_progress' || status === 'queued') {
        console.log(`   ⏳ CI выполняется... (${status})`);
        
        if (result.id) {
          const jobs = await getJobsStatus(result.id);
          if (jobs.length > 0) {
            const runningJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'queued');
            const completedJobs = jobs.filter(j => j.status === 'completed');
            const successJobs = jobs.filter(j => j.conclusion === 'success');
            console.log(`   📦 Jobs: ${successJobs.length}/${jobs.length} успешно, ${completedJobs.length}/${jobs.length} завершено`);
            if (runningJobs.length > 0) {
              console.log(`   ⏳ Выполняются: ${runningJobs.map(j => j.name).join(', ')}`);
            }
          }
        }
      }
      
      console.log(`   ⏱️  Следующая проверка через ${interval/1000} сек...\n`);
      
      if (status !== 'completed') {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      console.error(`❌ Ошибка при проверке: ${error.message}`);
      console.log(`\n📋 Проверьте статус вручную: https://github.com/${REPO}/actions\n`);
      process.exit(1);
    }
  }
  
  if (checkCount >= maxChecks) {
    console.log('⏱️  Достигнут лимит проверок.');
    console.log(`📋 Проверьте статус вручную: https://github.com/${REPO}/actions\n`);
  }
}

monitor().catch(console.error);

