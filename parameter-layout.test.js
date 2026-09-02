const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sourcePath = join(__dirname, 'parameter-layout.js');
const source = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '';

class Element {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.children = [];
    this.parentNode = null;
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
    const index = parent.children.indexOf(this);
    parent.insertBefore(child, parent.children[index + 1] || null);
  }
}

function harness() {
  const elements = new Map();
  const diag = new Element('diag');
  const hint = new Element('hint');
  const reference = new Element('referenceCard');
  const controls = new Element('controls');
  const status = new Element('stepStatus');
  const meta = new Element('meta');
  const docs = new Element('manufacturerDocs');
  const history = new Element('pathHistory');
  const nav = new Element('', 'btns');
  [hint, reference, controls, status, meta, docs, history, nav].forEach(child => diag.appendChild(child));
  [diag, hint, reference, controls, status, meta, docs, history].forEach(element => elements.set(element.id, element));

  const context = vm.createContext({
    window: {},
    document: { getElementById: id => elements.get(id) || null },
    renderStep() {},
  });
  vm.runInContext(source, context, { filename: 'parameter-layout.js' });
  return { context, diag, controls, reference, nav };
}

test('parameter modules move the completion control below the full operating procedure', () => {
  const app = harness();
  assert.equal(typeof app.context.window.positionParameterControls, 'function');

  app.context.window.positionParameterControls({ Procedure_ID:'F2M-PARAM-001', Step_ID:'F2MP-010' });

  assert.equal(app.diag.children.at(-2), app.controls);
  assert.equal(app.diag.children.at(-1), app.nav);
});

test('regular diagnostics restore controls to their normal position below the reference block', () => {
  const app = harness();
  assert.equal(typeof app.context.window.positionParameterControls, 'function');

  app.context.window.positionParameterControls({ Procedure_ID:'F2M-PARAM-001', Step_ID:'F2MP-010' });
  app.context.window.positionParameterControls({ Procedure_ID:'F2M-DIAG-107', Step_ID:'F107-010' });

  const referenceIndex = app.diag.children.indexOf(app.reference);
  assert.equal(app.diag.children[referenceIndex + 1], app.controls);
});
