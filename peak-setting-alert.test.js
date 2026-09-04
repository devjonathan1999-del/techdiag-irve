const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'settings.js'), 'utf8');

function createHarness(initialCollected, rows, stepId = 'SCHP-130') {
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
    card() {
      return descendants(root).find(node => node.id === 'settingsReference') || null;
    },
  };
}

const commonRows = [
  { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Modèle', 'Valeur attendue':'EVA2HPC3', Condition:'Schneider Charge' },
  { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Calibres disponibles', 'Valeur attendue':'16 / 20 / 25 / 32 / 40 / 50 A', Condition:'EVA2HPC3' },
];

test('SCHP-130 highlights the exact Peak Controller setting selected for 18 kVA triphasé', async () => {
  const rows = [
    ...commonRows,
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Intensité par phase', 'Valeur attendue':'30 A', Condition:'18 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Réglage courant max', 'Valeur attendue':'25 A', Condition:'18 kVA' },
  ];
  const app = createHarness({ type_alimentation_peak_param:'Triphasée', puissance_peak_param:'18 kVA' }, rows);
  await app.render();
  assert.ok(app.alert());
  assert.match(app.alert().textContent, /RÉGLAGE PEAK CONTROLLER\s*:\s*25 A/i);
  assert.match(app.alert().textContent, /18 kVA triphasé\s*[—-]\s*30 A par phase/i);
});

test('SCHP-M130 highlights the monophasé setting and never shows EVA2HPC3', async () => {
  const rows = [
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Mono', Élément:'Modèle', 'Valeur attendue':'EVA2HPC1', Condition:'Schneider Charge' },
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Mono', Élément:'Calibres disponibles', 'Valeur attendue':'32 / 40 / 50 A', Condition:'EVA2HPC1' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Mono', Élément:'Réglage courant max', 'Valeur attendue':'40 A', Condition:'9 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Modèle', 'Valeur attendue':'EVA2HPC3', Condition:'Schneider Charge' },
  ];
  const app = createHarness({ type_alimentation_peak_param:'Monophasée', puissance_peak_param:'9 kVA' }, rows, 'SCHP-M130');
  await app.render();
  assert.ok(app.alert());
  assert.match(app.alert().textContent, /RÉGLAGE PEAK CONTROLLER\s*:\s*40 A/i);
  assert.ok(app.card());
  assert.match(app.card().textContent, /EVA2HPC1/);
  assert.doesNotMatch(app.card().textContent, /EVA2HPC3/);
});

test('12 kVA triphasé shows 16 A plus the insufficient-power recommendation', async () => {
  const rows = [
    ...commonRows,
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Intensité par phase', 'Valeur attendue':'20 A', Condition:'12 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Réglage courant max', 'Valeur attendue':'16 A', Condition:'12 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Alerte puissance', 'Valeur attendue':'Puissance disponible insuffisante pour un usage confortable', Condition:'12 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Préconisation', 'Valeur attendue':'Augmenter la puissance d’abonnement', Condition:'12 kVA' },
  ];
  const app = createHarness({ type_alimentation_peak_param:'Triphasée', puissance_peak_param:'12 kVA' }, rows);
  await app.render();
  assert.ok(app.alert());
  assert.match(app.alert().textContent, /RÉGLAGE PEAK CONTROLLER\s*:\s*16 A/i);
  assert.match(app.alert().textContent, /12 kVA triphasé\s*[—-]\s*20 A par phase/i);
  assert.match(app.alert().textContent, /puissance disponible insuffisante/i);
  assert.match(app.alert().textContent, /augmenter la puissance d’abonnement/i);
});

test('6 and 9 kVA triphasé show pose interdite instead of a setting', async () => {
  for (const [kva, amps] of [['6 kVA', '10 A'], ['9 kVA', '15 A']]) {
    const rows = [
      ...commonRows,
      { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Intensité par phase', 'Valeur attendue':amps, Condition:kva },
      { Config_ID:'SCH-CFG-PEAK-001', Alimentation:'Tri', Élément:'Compatibilité installation', 'Valeur attendue':'Pose interdite', Condition:`${kva} triphasé` },
    ];
    const app = createHarness({ type_alimentation_peak_param:'Triphasée', puissance_peak_param:kva }, rows);
    await app.render();
    assert.ok(app.alert(), kva);
    assert.match(app.alert().textContent, /POSE INTERDITE/i, kva);
    assert.match(app.alert().textContent, new RegExp(kva.replace(' ', '\\s*') + ' triphasé', 'i'), kva);
    assert.doesNotMatch(app.alert().textContent, /RÉGLAGE PEAK CONTROLLER\s*:/i, kva);
  }
});
