const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const html = readFileSync(join(__dirname, 'index.html'), 'utf8');

function functionSlice(name, nextName) {
  const start = html.indexOf(`function ${name}`);
  const end = html.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`);
  return html.slice(start, end);
}

test('every rendered diagnostic step resets the viewport to the page top', () => {
  const renderStep = functionSlice('renderStep(step){', 'renderReference');
  assert.match(renderStep, /window\.scrollTo\(\{\s*top:\s*0,\s*left:\s*0,\s*behavior:\s*["']auto["']\s*\}\)/);
  assert.ok(
    renderStep.indexOf('window.scrollTo') > renderStep.indexOf('focus({preventScroll:true})'),
    'scroll reset must happen after the new step has been rendered and focused'
  );
});

test('Retour uses the same step renderer, so it also resets the viewport', () => {
  const back = functionSlice('back(){', 'renderStep');
  assert.match(back, /renderStep\(byStep\[currentStepId\]\)/);
});
