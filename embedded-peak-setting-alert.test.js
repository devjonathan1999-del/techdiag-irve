const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'settings.js'), 'utf8');

function createHarness(initialCollected, rows, stepId) {
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.style = {};
      this.id = '';
      this.className = '';
      this._textContent = '';
    }
    get textContent() {
      return this.children.length ? this.children.map(child => child.textContent).join('') : this._textContent;
    }
    set textContent(value) {
      this._textContent = String(value ?? '');
      this.children = [];
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }
    insertAdjacentElement(position, child) {
      assert.equal(position, 'afterend');
      child.parentNode = this.parentNode;
      const index = this.parentNode.children.indexOf(this);
      this.parentNode.children.splice(index + 1, 0, child);
    }
  }

  const root = new Element('section');
  const hint = new Element('div'); hint.id = 'hint'; root.appendChild(hint);
  const meta = new Element('div'); meta.id = 'meta'; root.appendChild(meta);
  const descendants = node => [node, ...node.children.flatMap(descendants)];

  const context = vm.createContext({
    window: {},
    console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(node => node.id === id) || null,
      createElement: tag => new Element(tag),
    },
    querySheet: async name => {
      assert.equal(name, 'Reglages');
      return rows;
    },
    currentStepId: stepId,
    collected: { ...initialCollected },
    renderStep() {},
  });

  vm.runInContext(source, context, { filename: 'settings.js' });

  return {
    async render() {
      await context.window.renderSettingsReference({ Step_ID:stepId, Unité:'SCH-CFG-PEAK-001' });
    },
    alert() {
      return descendants(root).find(node => node.id === 'peakSettingAlert') || null;
    },
  };
}

test('SBCL-PK-T130 shows the embedded triphasé Peak Controller setting', async () => {
  const rows = [
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Modèle', 'Valeur attendue':'EVA2HPC3', Condition:'Schneider Charge' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Intensité par phase', 'Valeur attendue':'30 A', Condition:'18 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Réglage courant max', 'Valeur attendue':'25 A', Condition:'18 kVA' },
  ];
  const app = createHarness({ type_alimentation_peak_param:'Triphasée', puissance_peak_param:'18 kVA' }, rows, 'SBCL-PK-T130');
  await app.render();
  assert.ok(app.alert());
  assert.match(app.alert().textContent, /RÉGLAGE PEAK CONTROLLER\s*:\s*25 A/i);
});

test('SBCL-PK-M130 shows the embedded monophasé Peak Controller setting', async () => {
  const rows = [
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Mono', Élément:'Modèle', 'Valeur attendue':'EVA2HPC1', Condition:'Schneider Charge' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Mono', Élément:'Réglage courant max', 'Valeur attendue':'40 A', Condition:'9 kVA' },
  ];
  const app = createHarness({ type_alimentation_peak_param:'Monophasée', puissance_peak_param:'9 kVA' }, rows, 'SBCL-PK-M130');
  await app.render();
  assert.ok(app.alert());
  assert.match(app.alert().textContent, /RÉGLAGE PEAK CONTROLLER\s*:\s*40 A/i);
});
