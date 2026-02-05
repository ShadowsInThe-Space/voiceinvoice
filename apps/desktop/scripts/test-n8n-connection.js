/* eslint-disable @typescript-eslint/no-var-requires */
const https = require('https');

const url = 'https://n8n.shadowsinthe.space/webhook/rechnungseingang';

console.log(`Testing connection to ${url}...`);

const req = https.request(url, { method: 'POST' }, (res) => {
  console.log(`Status Code: ${res.statusCode}`);

  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error('Connection Error:', e);
});

req.end();
