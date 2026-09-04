const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'visuals.js'), 'utf8');

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.id = '';
    this._textContent = '';
  }
  get textContent() { return this.children.length ? this.children.map(child => child.textContent).join('') : this._textContent; }
  set textContent(value) { this._textContent = String(value ?? ''); this.children = []; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
  insertAdjacentElement(position, child) {
    assert.equal(position, 'afterend');
    child.parentNode = this.parentNode;
    const index = this.parentNode.children.indexOf(this);
    this.parentNode.children.splice(index + 1, 0, child);
  }
}

test('Peak DIP visual is inserted after the setting alert when that alert is present', async () => {
  const root = new Element('section');
  const hint = new Element('div'); hint.id = 'hint'; root.appendChild(hint);
  const alert = new Element('div'); alert.id = 'peakSettingAlert'; root.appendChild(alert);
  const descendants = node => [node, ...node.children.flatMap(descendants)];

  const context = vm.createContext({
    window: {},
    console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(node => node.id === id) || null,
      createElement: tag => new Element(tag),
    },
    querySheet: async name => {
      assert.equal(name, 'Visuels_Terrain');
      return [{
        Procedure_ID:'SCH-PEAK-PARAM-001',
        Step_ID:'SCHP-130',
        Sujet:'Réglage DIP Peak Controller triphasé',
        URL:'peak-tri.png',
        Affichage:'Image',
        Condition_affichage:'type_alimentation_peak_param=Triphasée',
      }];
    },
    currentStepId:'SCHP-130',
    collected:{ type_alimentation_peak_param:'Triphasée' },
    renderStep() {},
  });

  vm.runInContext(source, context, { filename:'visuals.js' });
  await context.window.renderStepVisual({ Procedure_ID:'SCH-PEAK-PARAM-001', Step_ID:'SCHP-130' });

  assert.deepEqual(root.children.map(child => child.id), ['hint', 'peakSettingAlert', 'stepVisual']);
});
