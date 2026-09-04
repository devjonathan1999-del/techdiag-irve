const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'settings.js'), 'utf8');

class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.style = {}; this.id = ''; this.className = ''; this._textContent = ''; }
  get textContent() { return this.children.length ? this.children.map(child => child.textContent).join('') : this._textContent; }
  set textContent(value) { this._textContent = String(value ?? ''); this.children = []; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
  insertAdjacentElement(position, child) { assert.equal(position, 'afterend'); child.parentNode = this.parentNode; const i = this.parentNode.children.indexOf(this); this.parentNode.children.splice(i + 1, 0, child); }
}

async function renderSettings({ rows, collected, stepId }) {
  const root = new Element('section');
  const hint = new Element('div'); hint.id = 'hint'; root.appendChild(hint);
  const meta = new Element('div'); meta.id = 'meta'; root.appendChild(meta);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const context = vm.createContext({
    window:{}, console:{ warn(){} },
    document:{ getElementById:id => descendants(root).find(node => node.id === id) || null, createElement:tag => new Element(tag) },
    querySheet:async name => { assert.equal(name, 'Reglages'); return rows; },
    currentStepId:stepId,
    collected,
    renderStep(){},
  });
  vm.runInContext(source, context, { filename:'settings.js' });
  await context.window.renderSettingsReference({ Step_ID:stepId, Unité:'SCH-CFG-PEAK-001' });
  return descendants(root).find(node => node.id === 'settingsReference') || null;
}

test('Peak settings do not show compatibility rules for a different selected kVA', async () => {
  const rows = [
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Réglage courant max', 'Valeur attendue':'25 A', Condition:'18 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Compatibilité installation', 'Valeur attendue':'Pose interdite', Condition:'9 kVA triphasé' },
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Compatibilité installation', 'Valeur attendue':'Pose interdite', Condition:'12 kVA triphasé' },
  ];
  const card = await renderSettings({ rows, stepId:'SCHP-130', collected:{ type_alimentation_peak_param:'Triphasée', puissance_peak_param:'18 kVA' } });
  assert.ok(card);
  assert.match(card.textContent, /25 A/);
  assert.doesNotMatch(card.textContent, /Pose interdite/);
});

test('SCHP-M130 never renders triphasé settings when Monophasée was selected', async () => {
  const rows = [
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Mono', Élément:'Modèle', 'Valeur attendue':'EVA2HPC1', Condition:'Schneider Charge' },
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Mono', Élément:'Réglage courant max', 'Valeur attendue':'40 A', Condition:'9 kVA' },
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Modèle', 'Valeur attendue':'EVA2HPC3', Condition:'Schneider Charge' },
    { Config_ID:'SCH-CFG-PEAK-001', Configuration:'Peak Controller Schneider', Alimentation:'Tri', Élément:'Réglage courant max', 'Valeur attendue':'16 A', Condition:'9 kVA' },
  ];
  const card = await renderSettings({ rows, stepId:'SCHP-M130', collected:{ type_alimentation_peak_param:'Monophasée', puissance_peak_param:'9 kVA' } });
  assert.ok(card);
  assert.match(card.textContent, /EVA2HPC1/);
  assert.match(card.textContent, /40 A/);
  assert.doesNotMatch(card.textContent, /EVA2HPC3|16 A/);
});
