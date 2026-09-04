const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
const readability = readFileSync(join(__dirname, 'readability.js'), 'utf8');

test('diagnostic user view hides step status and technical details but keeps procedure status visible', () => {
  assert.match(html, /id="procedureStatus" class="badge"/);
  assert.match(readability, /\.step-status,\.meta\{display:none!important\}/);
});
