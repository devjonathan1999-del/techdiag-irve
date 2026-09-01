const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'settings.js'), 'utf8');

function createHarness(rows, initialCollected = {}) {
  class Element {
    constructor(tagName) { this.tagName = tagName; this.children = []; this.style = {}; this.textContent = ''; this.id = ''; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
    insertAdjacentElement(position, child) {
      assert.equal(position, 'afterend');
      child.parentNode = this.parentNode;
      const i = this.parentNode.children.indexOf(this);
      this.parentNode.children.splice(i + 1, 0, child);
    }
  }
  const root = new Element('section');
  const meta = new Element('div'); meta.id = 'meta'; root.appendChild(meta);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const context = vm.createContext({
    window: {}, console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(n => n.id === id) || null,
      createElement: tag => new Element(tag),
    },
    querySheet: async name => {
      assert.equal(name, 'Reglages');
      return typeof rows === 'function' ? rows() : rows;
    },
    currentStepId: '',
    collected: { ...initialCollected },
    renderStep() {},
  });
  vm.runInContext(source, context, { filename: 'settings.js' });
  return {
    context,
    async render(step) { context.currentStepId = step.Step_ID; await context.window.renderSettingsReference(step); },
    cards: () => descendants(root).filter(n => n.id === 'settingsReference'),
  };
}

const baseRows = [
  { Config_ID:'VEST-CFG-001', Configuration:'TIC Linky', Alimentation:'Mono', Élément:'SW3', 'Valeur attendue':'3', Condition:'', Statut:'Brouillon' },
  { Config_ID:'VEST-CFG-001', Configuration:'TIC Linky', Alimentation:'Mono', Élément:'SW2', 'Valeur attendue':'Haut', Condition:'', Statut:'Brouillon' },
  { Config_ID:'VEST-CFG-001', Configuration:'TIC Linky', Alimentation:'Mono', Élément:'DIP 2 à 6', 'Valeur attendue':'OFF', Condition:'DIP 1 indifférent', Statut:'Brouillon' },
  { Config_ID:'VEST-CFG-003', Configuration:'Pince CT', Alimentation:'Mono', Élément:'SW3', 'Valeur attendue':'1', Condition:'', Statut:'À valider' },
  { Config_ID:'VEST-CFG-003', Configuration:'Pince CT', Alimentation:'Mono', Élément:'DIP 4-5-6', 'Valeur attendue':'OFF/ON/OFF', Condition:'6 kVA', Statut:'À valider' },
  { Config_ID:'VEST-CFG-003', Configuration:'Pince CT', Alimentation:'Mono', Élément:'DIP 4-5-6', 'Valeur attendue':'ON/OFF/OFF', Condition:'9 kVA', Statut:'À valider' },
  { Config_ID:'VEST-CFG-003', Configuration:'Pince CT', Alimentation:'Mono', Élément:'Sens de la pince', 'Valeur attendue':'À contrôler', Condition:'', Statut:'À valider' },
  { Config_ID:'F2M-CFG-001', Configuration:'DPM', Alimentation:'Mono', Élément:'Adresse', 'Valeur attendue':'001', Condition:'', Statut:'Validé' },
];

test('Vestel shared branch displays the settings referenced by Config_ID', async () => {
  const app = createHarness(baseRows);
  await app.render({ Step_ID:'DISJ-314', Unité:'VEST-CFG-001' });
  assert.equal(app.cards().length, 1);
  const text = app.cards()[0].children.map(x => x.textContent).join(' ');
  assert.match(text, /Réglages attendus/);
  assert.match(text, /TIC Linky/);
  assert.match(text, /SW3.*3/);
  assert.match(text, /SW2.*Haut/);
  assert.match(text, /DIP 2 à 6.*OFF.*DIP 1 indifférent/);
});

test('conditional DIP table is displayed while unresolved placeholders are omitted', async () => {
  const app = createHarness(baseRows);
  await app.render({ Step_ID:'DISJ-316', Unité:'VEST-CFG-003' });
  const text = app.cards()[0].children.map(x => x.textContent).join(' ');
  assert.match(text, /6 kVA.*OFF\/ON\/OFF/);
  assert.match(text, /9 kVA.*ON\/OFF\/OFF/);
  assert.doesNotMatch(text, /Sens de la pince|À contrôler/);
});

test('Vestel parameter module only displays the DIP row matching the selected power', async () => {
  const app = createHarness(baseRows, { puissance_souscrite_vestel_ct:'9 kVA' });
  await app.render({ Step_ID:'VP-060', Unité:'VEST-CFG-003' });
  const text = app.cards()[0].children.map(x => x.textContent).join(' ');
  assert.match(text, /SW3.*1/);
  assert.match(text, /9 kVA.*ON\/OFF\/OFF/);
  assert.doesNotMatch(text, /6 kVA.*OFF\/ON\/OFF/);
});

test('Vestel settings card links to the uploaded GitHub capture only for Vestel configs', async () => {
  const vestel = createHarness(baseRows);
  await vestel.render({ Step_ID:'VP-040', Unité:'VEST-CFG-001' });
  const vestelLink = vestel.cards()[0].children.find(x => x.tagName === 'a');
  assert.ok(vestelLink);
  assert.equal(vestelLink.textContent, '🖼️ Voir le repérage de la borne Vestel');
  assert.equal(vestelLink.href, 'https://raw.githubusercontent.com/devjonathan1999-del/techdiag-irve/main/Capture/Borne%20VESTEL%20.png');
  assert.equal(vestelLink.target, '_blank');
  assert.match(vestelLink.rel, /noopener/);

  const f2m = createHarness(baseRows);
  await f2m.render({ Step_ID:'F2M-CFG', Unité:'F2M-CFG-001' });
  assert.equal(f2m.cards()[0].children.some(x => x.tagName === 'a'), false);
});

test('steps without a supported Config_ID do not display a settings block', async () => {
  const app = createHarness(baseRows);
  await app.render({ Step_ID:'DISJ-313', Unité:'' });
  assert.equal(app.cards().length, 0);
});

test('navigation removes previous settings and ignores late async results', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const app = createHarness(() => pending);
  const first = app.render({ Step_ID:'DISJ-314', Unité:'VEST-CFG-001' });
  const second = app.render({ Step_ID:'DISJ-313', Unité:'' });
  release(baseRows);
  await Promise.all([first, second]);
  assert.equal(app.cards().length, 0);
});
