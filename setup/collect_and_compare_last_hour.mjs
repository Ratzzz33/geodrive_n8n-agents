import { execFileSync } from 'node:child_process';
import https from 'https';

const HOST = 'https://n8n.rentflow.rentals/api/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'gNXRKIQpNubEazH7';

function fmtMinute(d){
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const mon = months[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  return `${dd}/${mon}/${yyyy}:${hh}:${mm}`;
}

function parseNginxDate(s){
  // s example: 03/Nov/2025:13:10:58 +0000
  const m = s.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/);
  if(!m) return null;
  const [_, dd, mon, yyyy, hh, mm, ss, tz] = m;
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const d = new Date(Date.UTC(Number(yyyy), months[mon], Number(dd), Number(hh), Number(mm), Number(ss)));
  // apply timezone offset
  const sign = tz[0] === '-' ? -1 : 1;
  const tzh = Number(tz.slice(1,3));
  const tzm = Number(tz.slice(3));
  const offsetMs = sign * (tzh*60 + tzm) * 60 * 1000;
  return new Date(d.getTime() - offsetMs);
}

async function fetchN8nCounts(cutoffMs){
  const headers = { 'X-N8N-API-KEY': KEY, 'Accept': 'application/json' };
  function fetchPage(cursor){
    const url = cursor ? `${HOST}/executions?workflowId=${WORKFLOW_ID}&limit=200&cursor=${encodeURIComponent(cursor)}` : `${HOST}/executions?workflowId=${WORKFLOW_ID}&limit=200`;
    return new Promise((resolve,reject)=>{
      https.get(url,{headers},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d));}catch(e){reject(new Error(d));}})}).on('error',reject);
    });
  }
  const map = new Map();
  let cursor; let pages=0; const now = Date.now();
  while(true){
    const j = await fetchPage(cursor);
    pages++;
    const arr = j.data||[];
    for(const e of arr){
      const t = new Date(e.startedAt).getTime();
      if(Number.isFinite(t) && t >= cutoffMs){
        const key = fmtMinute(new Date(t));
        map.set(key, (map.get(key)||0)+1);
      }
    }
    if(!j.nextCursor) break;
    const oldest = arr.length? new Date(arr[arr.length-1].startedAt).getTime(): now;
    if(oldest < cutoffMs) break;
    cursor = j.nextCursor;
    if(pages>30) break;
  }
  return map;
}

(async()=>{
  const now = Date.now();
  const cutoff = now - 60*60*1000;

  // Nginx last lines
  const out = execFileSync('python', ['setup/server_ssh.py', 'tail -n 20000 /var/log/nginx/webhook-access.log'], {encoding:'utf-8'});
  const mapNginx = new Map();
  for(const line of out.split(/\r?\n/)){
    const m = line.match(/\[([^\]]+)\]/);
    if(!m) continue;
    if(!/POST \/webhook\//.test(line)) continue;
    const d = parseNginxDate(m[1]);
    if(!d) continue;
    if(d.getTime() < cutoff) continue;
    const key = fmtMinute(d);
    mapNginx.set(key, (mapNginx.get(key)||0)+1);
  }

  const mapN8n = await fetchN8nCounts(cutoff);

  // Build union minutes (last 60 minutes rounded)
  const minutes = new Set();
  for(const k of mapNginx.keys()) minutes.add(k);
  for(const k of mapN8n.keys()) minutes.add(k);
  const keys = Array.from(minutes).sort();

  let sumNginx=0, sumN8n=0;
  console.log('Minute (UTC)                 Nginx  n8n');
  console.log('----------------------------------------');
  for(const k of keys){
    const a = mapNginx.get(k)||0; const b = mapN8n.get(k)||0;
    sumNginx += a; sumN8n += b;
    console.log(`${k.padEnd(26)} ${String(a).padStart(5)} ${String(b).padStart(4)}`);
  }
  console.log('----------------------------------------');
  const rate = sumNginx ? (sumN8n/sumNginx*100).toFixed(1) : 'n/a';
  console.log(`TOTAL                         ${String(sumNginx).padStart(5)} ${String(sumN8n).padStart(4)}  (${rate}%)`);
})();


