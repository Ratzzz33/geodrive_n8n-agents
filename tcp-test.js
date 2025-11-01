const net = require('net');

const host = '46.224.17.15';
const port = 5678;

console.log(`Attempting to connect to ${host}:${port}...`);

const client = new net.Socket();

client.connect(port, host, () => {
    console.log('Connection successful!');
    client.destroy(); // Close the connection immediately
});

client.on('error', (err) => {
    console.error(`Connection failed: ${err.message}`);
});

client.on('close', () => {
    console.log('Connection closed.');
});
