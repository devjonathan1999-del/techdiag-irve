const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync('peak-context.js', 'utf8');

class Element {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this.style = {};
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertAdjacentElement(position, child) {
    assert.equal(position, 'afterend');
    const index = this.parentNode.children.indexOf(this);
    child.parentNode = this.parentNode;
    this.parentNode.children.splice(index + 1, 0, child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(item => item !== this);
    this.parentNode = null;
  }
}

function harness(supply) {
  const diag = new Element('diag');
  const contextRow = new Element('', 'diagnostic-context');
  diag.appendChild(contextRow);

  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const document = {
    getElementById: id => descendants(diag).find(node => node.id === id) || null,
    querySelector: selector => selector === '#diag .diagnostic-context' ? contextRow : null,
    createElement: () => new Element(),
  };

  const context = vm.createContext({
    window: {},
    document,
    collected: supply ? { type_alimentation_peak_param: supply } : {},
    renderStep() {},
  });
  vm.runInContext(source, context, { filename:'peak-context.js' });
  return { context, document, diag };
}

test('mono selection renders only Monophasé • EVA2HPC1', () => {
  const app = harness('Monophasée');
  app.context.renderStep({ Procedure_ID:'SCH-PEAK-PARAM-001', Step_ID:'SCHP-M020' });
  const badge = app.document.getElementById('peakContextBadge');
  assert.ok(badge);
  assert.equal(badge.textContent, 'Monophasé • EVA2HPC1');
  assert.doesNotMatch(badge.textContent, /EVA2HPC3|Triphas/i);
});

test('tri selection renders only Triphasé • EVA2HPC3', () => {
  const app = harness('Triphasée');
  app.context.renderStep({ Procedure_ID:'SCH-PEAK-PARAM-001', Step_ID:'SCHP-T020' });
  const badge = app.document.getElementById('peakContextBadge');
  assert.ok(badge);
  assert.equal(badge.textContent, 'Triphasé • EVA2HPC3');
  assert.doesNotMatch(badge.textContent, /EVA2HPC1|Monophas/i);
});

test('context badge is absent before the Mono/Tri choice', () => {
  const app = harness('');
  app.context.renderStep({ Procedure_ID:'SCH-PEAK-PARAM-001', Step_ID:'SCHP-010' });
  assert.equal(app.document.getElementById('peakContextBadge'), null);
});

test('context badge is never rendered outside the Peak Controller module', () => {
  const app = harness('Triphasée');
  app.context.renderStep({ Procedure_ID:'IRVE-DIAG-001', Step_ID:'DISJ-400' });
  assert.equal(app.document.getElementById('peakContextBadge'), null);
});
