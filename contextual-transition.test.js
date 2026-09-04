const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const parameterLayout = readFileSync(join(__dirname, 'parameter-layout.js'), 'utf8');

function harness(originProcedureId) {
  const elements = new Map();

  class Element {
    constructor(id = '') {
      this.id = id;
      this.innerHTML = '';
      this.dataset = {};
      this.textContent = '';
    }
    querySelectorAll(selector) {
      assert.equal(selector, 'button');
      this.buttons = [...this.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => {
        const button = new Element();
        button.dataset.i = match[1].match(/data-i="(\d+)"/)?.[1];
        button.textContent = match[2].replace(/<[^>]*>/g, '');
        return button;
      });
      return this.buttons;
    }
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
  vm.runInContext(parameterLayout, context, { filename: 'parameter-layout.js' });

  context.fixture = {
    step: { Step_ID:'SCHP-260', Procedure_ID:'SCH-PEAK-PARAM-001' },
    transitions: [
      { Transition_ID:'SCHP260-REGLAGE', Libellé:'⚙️ Vérifier / régler le courant max', Next_Step_ID:'SCHP-100', Type_transition:'CHOIX' },
      { Transition_ID:'SCHP260-RETURN', Libellé:'↩ Retour au diagnostic', Next_Step_ID:'DISJ-400', Type_transition:'RETOUR_DIAGNOSTIC' },
      { Transition_ID:'SCHP260-END', Libellé:'Terminer', Next_Step_ID:'END', Type_transition:'CHOIX' },
    ],
  };
  vm.runInContext(`activeProcedureId=${JSON.stringify(originProcedureId)}; renderStructuredChoices(fixture.step, fixture.transitions)`, context);
  return get('controls').buttons.map(button => button.textContent);
}

test('standalone parameter module hides a diagnostic-only return transition', () => {
  const labels = harness('SCH-PEAK-PARAM-001');
  assert.deepEqual(labels, [
    '⚙️ Vérifier / régler le courant max',
    'Terminer',
  ]);
});

test('diagnostic caller keeps the return-to-diagnostic transition', () => {
  const labels = harness('IRVE-DIAG-001');
  assert.deepEqual(labels, [
    '⚙️ Vérifier / régler le courant max',
    '↩ Retour au diagnostic',
    'Terminer',
  ]);
});
