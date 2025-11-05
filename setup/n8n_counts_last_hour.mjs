import https from 'https';

const HOST = 'https://n8n.rentflow.rentals/api/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'gNXRKIQpNubEazH7';

const headers = { 'X-N8N-API-KEY': KEY, 'Accept': 'application/json' };

function fmtNginxMinute(d){
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const mon = months[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  return `${dd}/${mon}/${yyyy}:${hh}:${mm}`;
}

async function fetchPage(cursor){
  const url = cursor ? `${HOST}/executions?workflowId=${WORKFLOW_ID}&limit=200&cursor=${encodeURIComponent(cursor)}` : `${HOST}/executions?workflowId=${WORKFLOW_ID}&limit=200`;
  return new Promise((resolve,reject)=>{
    https.get(url,{headers},res=>{
      let data='';
      res.on('data',c=>data+=c);
      res.on('end',()=>{ try{ resolve(JSON.parse(data)); }catch(e){ reject(new Error('Parse error '+e.message+' body='+data.slice(0,200))); } });
    }).on('error',reject);
  });
}

(async()=>{
  const now = Date.now();
  const cutoff = now - 60*60*1000; // last hour
  const counts = new Map();
  let cursor; let pages=0; let total=0;
  while(true){
    const j = await fetchPage(cursor);
    pages++;
    const arr = j.data || [];
    for(const e of arr){
      const t = new Date(e.startedAt).getTime();
      if(Number.isFinite(t) && t>=cutoff){
        const key = fmtNginxMinute(new Date(t));
        counts.set(key, (counts.get(key)||0) + 1);
        total++;
      }
    }
    if (!j.nextCursor) break;
    const oldest = arr.length? new Date(arr[arr.length-1].startedAt).getTime(): now;
    if (oldest < cutoff) break;
    cursor = j.nextCursor;
    if (pages>20) break; // safety
  }

  const keys = Array.from(counts.keys()).sort();
  console.log('n8n per-minute counts (last 60m, UTC):');
  for(const k of keys){
    console.log(`${k} ${counts.get(k)}`);
  }
  console.log(`TOTAL ${total}`);
})();


