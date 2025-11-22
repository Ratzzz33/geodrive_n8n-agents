#!/usr/bin/env node
import 'dotenv/config';

const REPO = '33pok/geodrive_n8n-agents';
const GITHUB_API = `https://api.github.com/repos/${REPO}/actions/runs`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function checkCIStatus() {
  try {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'CI-Monitor'
    };
    
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${GITHUB_API}?per_page=1&branch=master`, {
      headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('⚠️  Репозиторий приватный или URL неправильный');
        console.log('📋 Проверьте вручную: https://github.com/33pok/geodrive_n8n-agents/actions\n');
        return { status: 'unknown', needsManualCheck: true };
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const latestRun = data.workflow_runs?.[0];

    if (!latestRun) {
      return { status: 'not_found', needsManualCheck: true };
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
    console.error('❌ Ошибка:', error.message);
    return { status: 'error', needsManualCheck: true };
  }
}

async function getJobsStatus(runId) {
  if (!runId) return [];
  
  try {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'CI-Monitor'
    };
    
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${GITHUB_API}/${runId}/jobs`, { headers });
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.jobs || [];
  } catch {
    return [];
  }
}

async function monitor() {
  console.log('🔍 Мониторинг CI статуса...\n');
  console.log('📋 Ссылка: https://github.com/33pok/geodrive_n8n-agents/actions\n');
  
  let checkCount = 0;
  const maxChecks = 60; // Максимум 60 проверок (10 минут при интервале 10 сек)
  const interval = 10000; // 10 секунд

  while (checkCount < maxChecks) {
    checkCount++;
    const result = await checkCIStatus();
    
    if (result.needsManualCheck) {
      console.log('⚠️  Требуется ручная проверка');
      break;
    }

    const status = result.status;
    const conclusion = result.conclusion;
    
    const time = new Date().toLocaleTimeString('ru-RU');
    console.log(`[${time}] Проверка #${checkCount}`);
    
    if (result.commitSha) {
      console.log(`   Коммит: ${result.commitSha} - ${result.commitMessage || 'N/A'}`);
    }
    
    if (status === 'completed') {
      if (conclusion === 'success') {
        console.log('   ✅ CI успешно завершен!');
        
        // Получаем статус jobs
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
      
      // Получаем статус jobs
      if (result.id) {
        const jobs = await getJobsStatus(result.id);
        if (jobs.length > 0) {
          const runningJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'queued');
          const completedJobs = jobs.filter(j => j.status === 'completed');
          console.log(`   📦 Jobs: ${completedJobs.length}/${jobs.length} завершено`);
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
  }
  
  if (checkCount >= maxChecks) {
    console.log('⏱️  Достигнут лимит проверок. Проверьте статус вручную:');
    console.log('   https://github.com/33pok/geodrive_n8n-agents/actions\n');
  }
}

monitor().catch(console.error);

