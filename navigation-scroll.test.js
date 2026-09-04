const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
const readability = readFileSync(join(__dirname, 'readability.js'), 'utf8');

function functionSlice(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`);
  return source.slice(start, end);
}

test('every rendered diagnostic step resets the viewport to the page top', () => {
  assert.match(readability, /originalRenderStep\(step\);[\s\S]*window\.scrollTo\(\{\s*top:\s*0,\s*left:\s*0,\s*behavior:\s*["']auto["']\s*\}\)/);
});

test('Retour uses the same step renderer, so it also resets the viewport', () => {
  const back = functionSlice(html, 'back(){', 'renderStep');
  assert.match(back, /renderStep\(byStep\[currentStepId\]\)/);
});
