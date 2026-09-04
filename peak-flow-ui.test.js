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
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
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

function renderContext(supply, stepId) {
  const diag = new Element('diag');
  const contextRow = new Element('', 'diagnostic-context');
  diag.appendChild(contextRow);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const document = {
    getElementById: id => descendants(diag).find(node => node.id === id) || null,
    querySelector: selector => selector === '#diag .diagnostic-context' ? contextRow : null,
    createElement: () => new Element(),
  };
  const context = vm.createContext({ window:{}, document, collected:{ type_alimentation_peak_param:supply }, renderStep(){} });
  vm.runInContext(source, context, { filename:'peak-context.js' });
  context.renderStep({ Procedure_ID:'SCH-PEAK-PARAM-001', Step_ID:stepId });
  return document.getElementById('peakContextBadge')?.textContent || '';
}

test('monophasé branch never advertises the triphasé model', () => {
  const label = renderContext('Monophasée', 'SCHP-M230');
  assert.equal(label, 'Monophasé • EVA2HPC1');
  assert.doesNotMatch(label, /EVA2HPC3|Triphas/i);
});

test('triphasé branch never advertises the monophasé model', () => {
  const label = renderContext('Triphasée', 'SCHP-230');
  assert.equal(label, 'Triphasé • EVA2HPC3');
  assert.doesNotMatch(label, /EVA2HPC1|Monophas/i);
});

test('build injects the Peak context renderer used by both branches', () => {
  const build = fs.readFileSync('build.js', 'utf8');
  assert.match(build, /peak-context\.js/);
  assert.match(build, /techdiag-peak-context/);
});
