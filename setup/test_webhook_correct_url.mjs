import axios from 'axios';

(async () => {
  const webhookUrl = 'https://n8n.rentflow.rentals/webhook/service-center-webhook';
  const testPayload = {
    event: "car_update",
    payload: JSON.stringify({
      id: 99999,
      car_name: "Test Car",
      state: [null, "active"],
      mileage: [10000, 10100],
      updated_at: new Date().toISOString()
    })
  };

  console.log(`Sending test webhook to: ${webhookUrl}`);
  console.log('Payload:', testPayload);

  try {
    const response = await axios.post(webhookUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Webhook sent successfully!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  } finally {
    process.exit();
  }
})();

