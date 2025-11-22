import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const workflowPath = 'n8n-workflows/rentprog-history-parser-active.json';

try {
  const content = readFileSync(workflowPath, 'utf-8');
  const workflow = JSON.parse(content);
  let updatedCount = 0;

  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.httpRequest' && 
        ['Get Tbilisi', 'Get Batumi', 'Get Kutaisi', 'Get Service'].includes(node.name)) {
      
      if (node.parameters && node.parameters.jsonBody) {
        // Заменяем per_page":50 на per_page":100
        const newBody = node.parameters.jsonBody.replace('"per_page":50', '"per_page":100');
        
        if (newBody !== node.parameters.jsonBody) {
          node.parameters.jsonBody = newBody;
          updatedCount++;
          console.log(`✅ Updated node: ${node.name}`);
        }
      }
    }
  });

  if (updatedCount > 0) {
    writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log(`\n🎉 Successfully updated ${updatedCount} nodes in ${workflowPath}`);
  } else {
    console.log('⚠️ No nodes needed update (already 100?)');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
}

