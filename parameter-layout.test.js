const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sourcePath = join(__dirname, 'parameter-layout.js');
const source = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '';

class Element {
  constructor(id = '', className = '', textContent = '') {
    this.id = id;
    this.className = className;
    this.children = [];
    this.parentNode = null;
    this.textContent = textContent;
  }
  get lastElementChild() { return this.children.at(-1) || null; }
  appendChild(child) {
    if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
    const index = this.children.indexOf(before);
    child.parentNode = this;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  insertAdjacentElement(position, child) {
    assert.equal(position, 'afterend');
    const parent = this.parentNode;
    if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
    const index = parent.children.indexOf(this);
    child.parentNode = parent;
    parent.children.splice(index + 1, 0, child);
  }
  querySelectorAll(selector) {
    const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
    if (selector === 'button') return descendants(this).filter(node => node.tagName === 'button');
    return [];
  }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this);
  }
}

function harness({ controlLabels = [] } = {}) {
  const elements = new Map();
  const diag = new Element('diag');
  const hint = new Element('hint');
  const reference = new Element('referenceCard');
  const controls = new Element('controls');
  const choices = new Element('', 'choices');
  controlLabels.forEach(label => {
    const button = new Element('', 'answer', label);
    button.tagName = 'button';
    choices.appendChild(button);
  });
  if (controlLabels.length) controls.appendChild(choices);
  const status = new Element('stepStatus');
  const meta = new Element('meta');
  const docs = new Element('manufacturerDocs');
  const history = new Element('pathHistory');
  const nav = new Element('', 'btns');
  [hint, reference, controls, status, meta, docs, history, nav].forEach(child => diag.appendChild(child));
  [diag, hint, reference, controls, status, meta, docs, history].forEach(element => elements.set(element.id, element));
  const descendants = node => [node, ...node.children.flatMap(descendants)];

  const document = {
    getElementById: id => descendants(diag).find(node => node.id === id) || null,
    createElement: tagName => {
      const element = new Element();
      element.tagName = tagName;
      return element;
    },
  };

  const context = vm.createContext({ window: {}, document, renderStep() {} });
  vm.runInContext(source, context, { filename: 'parameter-layout.js' });
  return { context, diag, controls, reference, nav, elements };
}

test('parameter-module choices stay in the main step body instead of being moved below documentation', () => {
  const app = harness({ controlLabels: ['Monophasée', 'Triphasée'] });
  assert.equal(typeof app.context.window.positionParameterControls, 'function');

  app.context.window.positionParameterControls({ Procedure_ID:'SCH-PEAK-PARAM-001', Step_ID:'SCHP-100' });

  const referenceIndex = app.diag.children.indexOf(app.reference);
  assert.equal(app.diag.children[referenceIndex + 1], app.controls);
  assert.notEqual(app.diag.children.at(-2), app.controls);
});

test('an exact Terminer choice is kept at the bottom while other choices remain in the main body', () => {
  const app = harness({ controlLabels: ['🔗 Appairer le Peak Controller', 'Terminer'] });

  app.context.window.positionParameterControls({ Procedure_ID:'SCH-PEAK-PARAM-001', Step_ID:'SCHP-130' });

  const mainLabels = app.controls.querySelectorAll('button').map(button => button.textContent.trim());
  assert.deepEqual(mainLabels, ['🔗 Appairer le Peak Controller']);

  const completion = app.context.document.getElementById('completionControls');
  assert.ok(completion, 'a bottom completion container must be created');
  assert.deepEqual(completion.querySelectorAll('button').map(button => button.textContent.trim()), ['Terminer']);
  assert.equal(app.diag.children.at(-2), completion);
  assert.equal(app.diag.children.at(-1), app.nav);
});

test('regular diagnostics keep their controls directly below the reference block', () => {
  const app = harness({ controlLabels: ['Conforme', 'Non conforme'] });

  app.context.window.positionParameterControls({ Procedure_ID:'F2M-DIAG-107', Step_ID:'F107-010' });

  const referenceIndex = app.diag.children.indexOf(app.reference);
  assert.equal(app.diag.children[referenceIndex + 1], app.controls);
});
