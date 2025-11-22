#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'w8g8cJb0ccReaqIE';

async function fixSQL() {
  try {
    console.log('🔧 Получаю workflow...\n');
    
    const response = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const workflow = await response.json();
    
    console.log('✅ Workflow получен:', workflow.name);
    console.log('');
    
    let changed = false;
    
    // Исправить ноду Save Payment to DB
    const saveNode = workflow.nodes.find(n => n.name === 'Save Payment to DB');
    
    if (saveNode && saveNode.parameters.query) {
      console.log('📝 Исправляю SQL в "Save Payment to DB"...');
      
      const oldQuery = saveNode.parameters.query;
      const newQuery = oldQuery
        .replace(/\bcar_id\b/g, 'rp_car_id')
        .replace(/\bclient_id\b/g, 'rp_client_id')
        .replace(/\buser_id\b/g, 'rp_user_id')
        .replace(/\bpayment_id\b/g, 'rp_payment_id');
      
      saveNode.parameters.query = newQuery;
      changed = true;
      
      console.log('   ✅ SQL обновлен');
      console.log('');
    }
    
    // Исправить ноду Prepare Batch Insert
    const prepNode = workflow.nodes.find(n => n.name === 'Prepare Batch Insert');
    
    if (prepNode && prepNode.parameters.jsCode) {
      console.log('📝 Исправляю код в "Prepare Batch Insert"...');
      
      const oldCode = prepNode.parameters.jsCode;
      const newCode = oldCode
        .replace(/p\.payment_id/g, 'p.rp_payment_id')
        .replace(/p\.car_id/g, 'p.rp_car_id')
        .replace(/p\.client_id/g, 'p.rp_client_id')
        .replace(/p\.user_id/g, 'p.rp_user_id');
      
      prepNode.parameters.jsCode = newCode;
      changed = true;
      
      console.log('   ✅ Код обновлен');
      console.log('');
    }
    
    if (!changed) {
      console.log('⚠️ Ничего не изменено');
      return;
    }
    
    console.log('💾 Сохраняю изменения...\n');
    
    // Удаляем системные поля
    delete workflow.id;
    delete workflow.versionId;
    delete workflow.updatedAt;
    delete workflow.createdAt;
    delete workflow.shared;
    delete workflow.tags;
    delete workflow.triggerCount;
    delete workflow.isArchived;
    delete workflow.meta;
    
    // Обновляем workflow
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    };
    
    if (workflow.staticData && Object.keys(workflow.staticData).length > 0) {
      updateData.staticData = workflow.staticData;
    }
    if (workflow.pinData && Object.keys(workflow.pinData).length > 0) {
      updateData.pinData = workflow.pinData;
    }
    
    const updateResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update: ${updateResponse.statusText}. ${errorText}`);
    }
    
    console.log('✅ Workflow успешно обновлен!');
    console.log('🔗 https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID);
    console.log('');
    console.log('📋 Исправленные имена колонок:');
    console.log('   car_id → rp_car_id');
    console.log('   client_id → rp_client_id');
    console.log('   user_id → rp_user_id');
    console.log('   payment_id → rp_payment_id');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

fixSQL();

