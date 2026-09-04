const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

function harness() {
  const elements = new Map();
  class Element {
    constructor(id = '') {
      this.id = id;
      this.innerHTML = '';
      this.textContent = '';
      this.className = '';
      const classes = new Set();
      this.classList = {
        add: x => classes.add(x),
        remove: x => classes.delete(x),
        contains: x => classes.has(x),
      };
    }
    focus() {}
  }
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const context = vm.createContext({
    console,
    window: {},
    document: { getElementById: get },
    google: { charts: { load() {}, setOnLoadCallback() {} } },
    alert: message => { throw new Error(message); },
  });
  vm.runInContext(script, context);
  return { get, run: code => vm.runInContext(code, context) };
}

function setFixture(app, phase, kva) {
  app.run(`
    activeProcedureTitle = 'Installation générale disjoncte';
    collected = { type_alimentation: ${JSON.stringify(phase)}, puissance_souscrite: ${JSON.stringify(kva + ' kVA')} };
    references = [
      { Diagnostic:'Installation générale disjoncte', 'Contrôle':'Monophasé 9 kVA', 'Règle conforme':'AGCP réglé à 45 A' },
      { Diagnostic:'Installation générale disjoncte', 'Contrôle':'Triphasé 6 kVA', 'Règle conforme':'AGCP réglé à 10 A par phase' }
    ];
  `);
}

test('AGCP reminder shows the expected value for a selected monophasé subscription', () => {
  const app = harness();
  setFixture(app, 'Monophasée', 9);
  app.run(`renderReference({ 'Instruction / question':'Le calibre / réglage de l’AGCP intérieur est-il cohérent avec la puissance souscrite ?', 'Donnée_collectée':'calibre_db_interieur' })`);
  assert.match(app.get('referenceCard').innerHTML, /9 kVA monophasé/);
  assert.match(app.get('referenceCard').innerHTML, /45 A/);
  assert.equal(app.get('referenceCard').className, 'manualcheck');
});

test('AGCP reminder keeps the per-phase value for triphasé subscriptions', () => {
  const app = harness();
  setFixture(app, 'Triphasée', 6);
  app.run(`renderReference({ 'Instruction / question':'Le calibre / réglage de l’AGCP extérieur est-il cohérent avec la puissance souscrite ?', 'Donnée_collectée':'calibre_db_exterieur' })`);
  assert.match(app.get('referenceCard').innerHTML, /6 kVA triphasé/);
  assert.match(app.get('referenceCard').innerHTML, /10 A par phase/);
});
