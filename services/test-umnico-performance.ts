/**
 * Тест производительности Umnico Playwright Service
 * 
 * Проверяет сколько времени занимает синхронизация 20 чатов
 */

async function testPerformance() {
  const baseUrl = 'http://46.224.17.15:3001';
  
  console.log('🧪 Starting Umnico Performance Test...\n');
  
  // 1. Test: Get conversations list
  console.log('📋 Test 1: Get 20 conversations');
  const start1 = Date.now();
  
  const conversationsResponse = await fetch(`${baseUrl}/api/conversations?limit=20`);
  const conversationsData = await conversationsResponse.json();
  
  const time1 = Date.now() - start1;
  console.log(`✅ Got ${conversationsData.count} conversations in ${time1}ms`);
  console.log(`   Average: ${(time1 / conversationsData.count).toFixed(0)}ms per conversation\n`);
  
  if (!conversationsData.ok || conversationsData.count === 0) {
    console.error('❌ No conversations found, aborting test');
    return;
  }
  
  // 2. Test: Get messages for 5 conversations (sample)
  console.log('💬 Test 2: Get messages for 5 conversations (sample)');
  const sampleSize = Math.min(5, conversationsData.count);
  const sampleConversations = conversationsData.data.slice(0, sampleSize);
  
  const start2 = Date.now();
  let totalMessages = 0;
  
  for (const conv of sampleConversations) {
    if (!conv.conversationId) continue;
    
    const convStart = Date.now();
    const messagesResponse = await fetch(`${baseUrl}/api/conversations/${conv.conversationId}/messages`);
    const messagesData = await messagesResponse.json();
    const convTime = Date.now() - convStart;
    
    totalMessages += messagesData.count || 0;
    console.log(`   - Conversation ${conv.conversationId}: ${messagesData.count} messages in ${convTime}ms`);
  }
  
  const time2 = Date.now() - start2;
  const avgTimePerConv = time2 / sampleSize;
  
  console.log(`\n✅ Sample completed in ${time2}ms`);
  console.log(`   Average: ${avgTimePerConv.toFixed(0)}ms per conversation`);
  console.log(`   Total messages: ${totalMessages}\n`);
  
  // 3. Extrapolate for 20 conversations
  console.log('📊 Extrapolation for 20 conversations:');
  const estimated20 = (time1 + avgTimePerConv * 20) / 1000;
  console.log(`   Estimated time: ${estimated20.toFixed(1)} seconds`);
  console.log(`   That's ${(estimated20 / 60).toFixed(1)} minutes\n`);
  
  // 4. Recommendations
  console.log('💡 Recommendations:');
  if (estimated20 < 30) {
    console.log('   ✅ Performance is GOOD! Can sync every 1-2 minutes');
  } else if (estimated20 < 60) {
    console.log('   ⚠️  Performance is OK. Keep 5-minute interval or optimize');
  } else if (estimated20 < 120) {
    console.log('   ⚠️  Performance is SLOW. Consider optimizations:');
    console.log('      - Use Umnico API directly (fetch instead of page.goto)');
    console.log('      - Limit to recent conversations only');
    console.log('      - Increase interval to 10-15 minutes');
  } else {
    console.log('   ❌ Performance is VERY SLOW. Urgent optimization needed!');
    console.log('      - MUST use Umnico API directly');
    console.log('      - Implement incremental sync (only changed conversations)');
    console.log('      - Consider 30-minute interval');
  }
  
  console.log('\n✅ Test completed!');
}

// Run test
testPerformance().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});

