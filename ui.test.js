const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

// DOM boundary only. The catalogue, routing, records and renderers below are
// the actual inline application code; Google network loading is not needed.
function harness() {
  const elements = new Map();
  class Element {
    constructor(id = '') {
      this.id = id; this.innerHTML = ''; this.textContent = ''; this.value = '';
      this.style = {}; this.dataset = {}; this.open = false; this.hidden = false;
      const classes = new Set();
      this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) };
    }
    setAttribute(name, value) { this[name] = String(value); }
    focus() {}
    querySelectorAll(selector) {
      assert.equal(selector, 'button');
      this.buttons = [...this.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => {
        const button = new Element();
        button.dataset.i = m[1].match(/data-i="(\d+)"/)?.[1];
        button.textContent = m[2].replace(/<[^>]*>/g, '');
        return button;
      });
      return this.buttons;
    }
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const context = vm.createContext({ console, document: { getElementById: get },
    google: { charts: { load() {}, setOnLoadCallback() {} } }, alert: message => { throw Error(message); } });
  vm.runInContext(script, context);
  const run = code => vm.runInContext(code, context);
  context.fixture = {
    catalogue: [
      { Procedure_ID:'A', Famille:'Diagnostic', Marque:'Schneider Electric', 'Modèle / périmètre':'Charge 22', Titre:'Borne bleue', 'Symptôme / déclencheur':'Attente de charge différée', Statut:'En construction' },
      { Procedure_ID:'B', Famille:'Diagnostic', Marque:'Schneider Electric', 'Modèle / périmètre':'Charge 7', Titre:'Erreur réseau', Statut:'Validé TechDiag' },
      { Procedure_ID:'C', Famille:'Diagnostic', Marque:'Free2move', 'Modèle / périmètre':'Move', Titre:'Bleu fixe', Statut:'Validé TechDiag' },
    ],
    steps: [
      { Step_ID:'A-010', Procedure_ID:'A', Ordre:10, 'Instruction / question':'Question exacte ?', 'Condition / interprétation':'Consigne de sécurité à garder visible.', 'Type_réponse':'Confirmation', Next_OK:'A-900', Source:'Expertise utilisateur <validée>', Statut:'À valider', 'Donnée_collectée':'controle' },
      { Step_ID:'A-020', Procedure_ID:'A', Ordre:20, 'Instruction / question':'Branche non parcourue', 'Type_réponse':'Confirmation' },
      { Step_ID:'A-900', Procedure_ID:'A', Ordre:900, 'Instruction / question':'Contrôle suivant', 'Type_réponse':'Confirmation', Next_OK:'B-010', Statut:'Validé TechDiag' },
      { Step_ID:'B-010', Procedure_ID:'B', Ordre:10, 'Instruction / question':'Sous-procédure', 'Type_réponse':'Confirmation', Next_OK:'END', Statut:'À valider' },
      { Step_ID:'B-400', Procedure_ID:'B', Ordre:400, 'Instruction / question':'Smartcharge', 'Type_réponse':'Confirmation', Next_OK:'END', Statut:'En construction' },
    ],
  };
  run(`catalogue=fixture.catalogue; steps=fixture.steps;
    catalogue.forEach(p=>catalogueByProcedure[p.Procedure_ID]=p);
    steps.forEach(s=>{byStep[s.Step_ID]=s;(byProcedure[s.Procedure_ID]??=[]).push(s)});`);
  return { get, run };
}

test('model selection narrows results without changing the diagnostic catalogue', () => {
  const app = harness();
  app.run("activeModel='Charge 22'; renderCatalogue()");
  assert.equal(app.get('resultCount').textContent, '1 diagnostic trouvé');
  assert.match(app.get('catalogue').innerHTML, /Borne bleue/);
  assert.doesNotMatch(app.get('catalogue').innerHTML, /Erreur réseau|Bleu fixe/);
  assert.equal(app.run('catalogue.length'), 3);
});

test('changing brand resets a previous incompatible model selection', () => {
  const app = harness();
  app.run("activeModel='Charge 22'; setBrand('Free2move')");
  assert.equal(app.run('activeModel'), 'all');
  assert.match(app.get('catalogue').innerHTML, /Bleu fixe/);
  assert.doesNotMatch(app.get('modelFilter').innerHTML, /Charge 22/);
});

test('model options preserve exact source perimeters, including combined models', () => {
  const app = harness();
  app.run("catalogue[2]['Modèle / périmètre']='Move / Full'; renderCatalogue()");
  assert.match(app.get('modelFilter').innerHTML, /Move \/ Full/);
});

test('compact cards omit repeated descriptions but search still finds hidden symptoms', () => {
  const app = harness();
  app.get('search').value = 'schneider différée';
  app.run('renderCatalogue()');
  assert.equal(app.get('resultCount').textContent, '1 diagnostic trouvé');
  assert.match(app.get('catalogue').innerHTML, /Borne bleue/);
  assert.doesNotMatch(app.get('catalogue').innerHTML, /Attente de charge différée/);
});

test('progress counts the travelled path rather than the position in the full graph', () => {
  const app = harness();
  app.run("startProcedure('A')");
  assert.equal(app.get('stepLabel').textContent, 'Étape 1');
  app.run("recordAndGo(byStep['A-010'],'Oui','A-900')");
  assert.equal(app.get('stepLabel').textContent, 'Étape 2');
  app.run("recordAndGo(byStep['A-900'],'Confirmé','B-010')");
  assert.equal(app.get('stepLabel').textContent, 'Étape 3');
  assert.equal(app.get('procLabel').textContent, 'Erreur réseau');
});

test('read-only history shows only recorded answers and rolls back with Retour', () => {
  const app = harness();
  app.run("startProcedure('A'); recordAndGo(byStep['A-010'],'Oui','A-900')");
  assert.match(app.get('historyEntries').innerHTML, /Question exacte \?/);
  assert.match(app.get('historyEntries').innerHTML, /Oui/);
  assert.doesNotMatch(app.get('historyEntries').innerHTML, /Branche non parcourue/);
  app.run('back()');
  assert.equal(app.get('historyEntries').innerHTML, '');
  assert.equal(app.get('stepLabel').textContent, 'Étape 1');
  assert.equal(app.run('JSON.stringify(collected)'), '{}');
});

test('starting another procedure clears previous history and count', () => {
  const app = harness();
  app.run("startProcedure('A'); recordAndGo(byStep['A-010'],'Oui','A-900'); startProcedure('B')");
  assert.equal(app.get('historyEntries').innerHTML, '');
  assert.equal(app.get('stepLabel').textContent, 'Étape 1');
});

test('procedure and step statuses remain distinct and never imply global validation', () => {
  const app = harness();
  app.run("startProcedure('A'); recordAndGo(byStep['A-010'],'Oui','A-900')");
  assert.equal(app.get('procedureStatus').textContent, 'Procédure : En construction');
  assert.equal(app.get('stepStatus').textContent, 'Étape : Validé TechDiag');
});

test('construction badge comes from the target step, not the whole procedure', () => {
  const app = harness();
  app.run(`transitionsByStep['A-010']=[
    { Libellé:'Charge pilotée par Smartcharge', Next_Step_ID:'B-400' },
    { Libellé:'Contrôle normal', Next_Step_ID:'A-900' }
  ]; startProcedure('A')`);
  const buttons = app.get('controls').querySelectorAll('button');
  assert.match(buttons[0].textContent, /En construction/);
  assert.doesNotMatch(buttons[1].textContent, /En construction/);
  assert.equal(app.run("transitionsByStep['A-010'][0].Libellé"), 'Charge pilotée par Smartcharge');
});

test('question typography adapts to text length without changing the text', () => {
  const app = harness();

  app.run("byStep['A-010']['Instruction / question']='Question courte ?'; startProcedure('A')");
  assert.equal(app.get('question').className, 'question');
  assert.equal(app.get('question').textContent, 'Question courte ?');

  app.run("byStep['A-010']['Instruction / question']='x'.repeat(120); startProcedure('A')");
  assert.equal(app.get('question').className, 'question compact');
  assert.equal(app.get('question').textContent.length, 120);

  app.run("byStep['A-010']['Instruction / question']='x'.repeat(220); startProcedure('A')");
  assert.equal(app.get('question').className, 'question dense');
  assert.equal(app.get('question').textContent.length, 220);
});

test('questions, safety guidance and provenance survive presentation changes verbatim', () => {
  const app = harness();
  const before = app.run('JSON.stringify(fixture)');
  app.run("startProcedure('A')");
  assert.equal(app.get('question').className, 'question');
  assert.equal(app.get('question').textContent, 'Question exacte ?');
  assert.equal(app.get('hint').textContent, 'Consigne de sécurité à garder visible.');
  assert.match(app.get('meta').innerHTML, /Expertise utilisateur &lt;validée&gt;/);
  assert.match(app.get('meta').innerHTML, /<details/);
  assert.equal(app.run('JSON.stringify(fixture)'), before);
});

test('history escapes entered observations instead of interpreting HTML', () => {
  const app = harness();
  app.run("startProcedure('A'); recordAndGo(byStep['A-010'],'<img src=x onerror=alert(1)>','A-900')");
  assert.match(app.get('historyEntries').innerHTML, /&lt;img/);
  assert.doesNotMatch(app.get('historyEntries').innerHTML, /<img/);
});

test('clicking a badged choice follows the original target and records only its original value', () => {
  const app = harness();
  app.run(`transitionsByStep['A-010']=[{ Libellé:'Smartcharge', Valeur_collectée:'smartcharge', Next_Step_ID:'B-400' }]; startProcedure('A')`);
  app.get('controls').buttons[0].onclick();
  assert.equal(app.run('currentStepId'), 'B-400');
  assert.equal(app.run('reportLog[0].answer'), 'smartcharge');
  assert.equal(app.run('collected.controle'), 'smartcharge');
  assert.equal(app.get('stepStatus').textContent, 'Étape : En construction');
});

test('numeric rule routing keeps collected values and does not turn an out-of-range value into a pass', () => {
  const app = harness();
  app.run(`byStep['A-010']['Type_réponse']='Numérique'; byStep['A-010'].Next_NOK='B-400';
    ruleByStep['A-010']={Operateur:'BETWEEN_INC',Valeur_min:10,Valeur_max:20}; startProcedure('A')`);
  app.get('num').value = '9';
  app.get('numok').onclick();
  assert.equal(app.run('currentStepId'), 'B-400');
  assert.equal(app.run('collected.controle'), '9');
  app.run('back()');
  app.get('num').value = '10';
  app.get('numok').onclick();
  assert.equal(app.run('currentStepId'), 'A-900');
  assert.equal(app.run('reportLog.length'), 1);
  assert.equal(app.get('stepLabel').textContent, 'Étape 2');
});

test('finishing and starting a new diagnostic preserves the final result and clears the previous session', () => {
  const app = harness();
  app.run("startProcedure('B')");
  app.get('cont').onclick();
  assert.equal(app.get('final').classList.contains('hidden'), false);
  assert.equal(app.get('finalTitle').textContent, 'Sous-procédure');
  app.run("resetApp(); startProcedure('A')");
  assert.equal(app.run('reportLog.length'), 0);
  assert.equal(app.run('historyStack.length'), 0);
  assert.equal(app.get('pathHistory').classList.contains('hidden'), true);
});
