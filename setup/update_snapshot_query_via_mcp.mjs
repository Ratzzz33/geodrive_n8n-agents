import fs from 'fs';

// Читаем исправленный SQL запрос
const sqlQuery = fs.readFileSync('setup/fixed_snapshot_query_no_cte_v4.sql', 'utf8');

console.log('📝 SQL Query loaded (length:', sqlQuery.length, 'characters)');
console.log('✅ Contains fetched_at:', sqlQuery.includes('fetched_at'));
console.log('✅ Contains ON CONSTRAINT:', sqlQuery.includes('ON CONSTRAINT'));
console.log('');
console.log('🔧 Используйте MCP инструмент n8n_update_partial_workflow со следующими параметрами:');
console.log('');
console.log('id: "ihRLR0QCJySx319b"');
console.log('operations: [');
console.log('  {');
console.log('    "type": "updateNode",');
console.log('    "nodeName": "Save Snapshot",');
console.log('    "updates": {');
console.log('      "parameters": {');
console.log('        "query": "<SQL_QUERY_HERE>"');
console.log('      }');
console.log('    }');
console.log('  }');
console.log(']');
console.log('');
console.log('⚠️  Замените <SQL_QUERY_HERE> на содержимое setup/fixed_snapshot_query_no_cte_v4.sql');

