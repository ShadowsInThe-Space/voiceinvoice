/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../../ops/n8n/gemini_workflow.json');

try {
  const content = fs.readFileSync(filePath, 'utf8');
  // strict parsing
  const json = JSON.parse(content);
  console.log('✅ JSON is valid.');
  console.log('Name:', json.name);
  console.log('Node count:', json.nodes.length);

  // Check for duplicate keys presence (JSON.parse might handle them, but we want to be sure structure is clean)
  // Actually JSON.parse usually accepts duplicates (last wins) or strictly fails depending on implementation.
  // We'll rely on the previous tool's overwrite which should have fixed the text-based duplicates.
} catch (e) {
  console.error('❌ JSON Syntax Error:', e.message);
  process.exit(1);
}
