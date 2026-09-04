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
      this.id = id; this.innerHTML = ''; this.textContent = ''; this.value = '';
      this.style = {}; this.dataset = {}; this.open = false; this.hidden = false;
      const classes = new Set();
      this.classList = { add:x=>classes.add(x), remove:x=>classes.delete(x), contains:x=>classes.has(x) };
    }
    setAttribute(name, value) { this[name] = String(value); }
    focus() {}
    querySelectorAll(selector) {
      assert.equal(selector, 'button');
      if (this.buttons && this._buttonsMarkup === this.innerHTML) return this.buttons;
      this._buttonsMarkup = this.innerHTML;
      this.buttons = [...this.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => {
        const b = new Element();
        b.dataset.i = m[1].match(/data-i="(\d+)"/)?.[1];
        b.textContent = m[2].replace(/<[^>]*>/g, '');
        return b;
      });
      return this.buttons;
    }
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const context = vm.createContext({
    console, window: {}, document: { getElementById:get },
    google: { charts:{ load(){}, setOnLoadCallback(){} } },
    alert: message => { throw Error(message); },
  });
  vm.runInContext(script, context);
  return { get, run: code => vm.runInContext(code, context) };
}

function load(app, catalogue, steps, transitions) {
  app.run(`catalogue=${JSON.stringify(catalogue)};steps=${JSON.stringify(steps)};
    catalogue.forEach(p=>catalogueByProcedure[p.Procedure_ID]=p);
    steps.forEach(s=>{byStep[s.Step_ID]=s;(byProcedure[s.Procedure_ID]??=[]).push(s)});
    Object.assign(transitionsByStep,${JSON.stringify(transitions)});`);
}

function click(app, label) {
  const controls = app.get('controls');
  const choices = controls.buttons || controls.querySelectorAll('button');
  const button = choices.find(b => b.textContent.trim() === label || b.textContent.includes(label));
  assert.ok(button, `Choice not found: ${label}; got ${choices.map(b=>b.textContent).join(' | ')}`);
  assert.equal(typeof button.onclick, 'function', `Choice has no handler: ${label}`);
  button.onclick();
}

function confirm(app) {
  assert.equal(typeof app.get('cont').onclick, 'function', `No confirmation at ${app.run('currentStepId')}`);
  app.get('cont').onclick();
}

function collected(app, key) { return app.run(`collected[${JSON.stringify(key)}]`); }
function visited(app) { return JSON.parse(app.run('JSON.stringify(reportLog.map(x=>x.stepId))')); }

function mkStep(proc, id, order, response, key, next = '', question = id) {
  return {
    Procedure_ID:proc, Step_ID:id, Ordre:order,
    Type_étape:response === 'Confirmation' ? 'Action' : 'Question',
    'Instruction / question':question, 'Type_réponse':response,
    'Donnée_collectée':key, Next_OK:next, Statut:'À valider',
  };
}

const powerCatalogue = [{ Procedure_ID:'POWER', Famille:'Diagnostic', Marque:'IRVE', Titre:'Puissance souscrite', Statut:'À valider' }];
const powerSteps = [
  mkStep('POWER','DISJ-090',90,'Choix','type_alimentation'),
  mkStep('POWER','DISJ-100',100,'Choix','puissance_souscrite'),
  mkStep('POWER','DISJ-105',105,'Choix','puissance_souscrite'),
  mkStep('POWER','DISJ-109',109,'Numérique / observation','puissance_souscrite','DISJ-110'),
  mkStep('POWER','DISJ-110',110,'Confirmation','fin','END'),
];
const powerTransitions = {
  'DISJ-090':[
    {Libellé:'Monophasée',Valeur_collectée:'Monophasée',Next_Step_ID:'DISJ-100'},
    {Libellé:'Triphasée',Valeur_collectée:'Triphasée',Next_Step_ID:'DISJ-105'},
  ],
  'DISJ-100':[
    ...[3,6,9,12,15].map(v=>({Libellé:`${v} kVA`,Valeur_collectée:`${v} kVA`,Next_Step_ID:'DISJ-110'})),
    {Libellé:'Autre',Valeur_collectée:'Autre',Next_Step_ID:'DISJ-109'},
  ],
  'DISJ-105':[
    ...[6,9,12,15,18,24,30,36].map(v=>({Libellé:`${v} kVA`,Valeur_collectée:`${v} kVA`,Next_Step_ID:'DISJ-110'})),
    {Libellé:'Autre',Valeur_collectée:'Autre',Next_Step_ID:'DISJ-109'},
  ],
};

test('DISJ-100 renders only mono powers and stores puissance_souscrite', () => {
  const app = harness(); load(app,powerCatalogue,powerSteps,powerTransitions); app.run("startProcedure('POWER')");
  click(app,'Monophasée');
  assert.equal(app.run('currentStepId'),'DISJ-100');
  assert.deepEqual(app.get('controls').buttons.map(b=>b.textContent.trim()),['3 kVA','6 kVA','9 kVA','12 kVA','15 kVA','Autre']);
  click(app,'9 kVA');
  assert.equal(app.run('currentStepId'),'DISJ-110');
  assert.equal(collected(app,'type_alimentation'),'Monophasée');
  assert.equal(collected(app,'puissance_souscrite'),'9 kVA');
});

test('DISJ-105 renders only tri powers and Autre replaces the temporary value', () => {
  const app = harness(); load(app,powerCatalogue,powerSteps,powerTransitions); app.run("startProcedure('POWER')");
  click(app,'Triphasée');
  assert.equal(app.run('currentStepId'),'DISJ-105');
  assert.deepEqual(app.get('controls').buttons.map(b=>b.textContent.trim()),['6 kVA','9 kVA','12 kVA','15 kVA','18 kVA','24 kVA','30 kVA','36 kVA','Autre']);
  click(app,'Autre');
  assert.equal(app.run('currentStepId'),'DISJ-109');
  app.get('txt').value='20'; app.get('txtok').onclick();
  assert.equal(app.run('currentStepId'),'DISJ-110');
  assert.equal(collected(app,'type_alimentation'),'Triphasée');
  assert.equal(collected(app,'puissance_souscrite'),'20');
});

const hagerCatalogue = [{ Procedure_ID:'HAGER', Famille:'Diagnostic', Marque:'Hager', Titre:'XEV replay', Statut:'À valider' }];
const hagerSteps = [
  mkStep('HAGER','DISJ-450',450,'Choix','type_alimentation_hager_xev'),
  mkStep('HAGER','DISJ-451',451,'Choix','potentiometre_xev304_conforme'),
  mkStep('HAGER','DISJ-452',452,'Choix','potentiometre_xev305_conforme'),
  mkStep('HAGER','DISJ-453',453,'Confirmation','correction_potentiometre_xev304','DISJ-455'),
  mkStep('HAGER','DISJ-454',454,'Confirmation','correction_potentiometre_xev305','DISJ-456'),
  mkStep('HAGER','DISJ-455',455,'Choix','tore_xev304_conforme'),
  mkStep('HAGER','DISJ-456',456,'Choix','tores_xev305_conformes'),
  mkStep('HAGER','DISJ-457',457,'Confirmation','correction_tore_xev304','DISJ-459'),
  mkStep('HAGER','DISJ-458',458,'Confirmation','correction_tores_xev305','DISJ-460'),
  mkStep('HAGER','DISJ-459',459,'Choix','liaison_tic_xev304_conforme'),
  mkStep('HAGER','DISJ-460',460,'Choix','liaison_tic_xev305_conforme'),
  mkStep('HAGER','DISJ-461',461,'Confirmation','correction_liaison_tic_xev304','DISJ-463'),
  mkStep('HAGER','DISJ-462',462,'Confirmation','correction_liaison_tic_xev305','DISJ-464'),
  mkStep('HAGER','DISJ-463',463,'Choix','carte_tic_xev304_presente'),
  mkStep('HAGER','DISJ-464',464,'Choix','carte_tic_xev305_presente'),
  mkStep('HAGER','DISJ-465',465,'Confirmation','correction_carte_tic_xev304','DISJ-467'),
  mkStep('HAGER','DISJ-466',466,'Confirmation','correction_carte_tic_xev305','DISJ-468'),
  mkStep('HAGER','DISJ-467',467,'Choix','test_reduction_potentiometre_xev304'),
  mkStep('HAGER','DISJ-468',468,'Choix','test_reduction_potentiometre_xev305'),
  mkStep('HAGER','DISJ-469',469,'Confirmation','delestage_xev304_fonctionnel','END'),
  mkStep('HAGER','DISJ-470',470,'Confirmation','delestage_xev305_fonctionnel','END'),
  mkStep('HAGER','DISJ-471',471,'Confirmation','escalade_hotline_hager_xev304','END','Contacter la hotline Hager au 09 69 39 07 12 pour escalade du diagnostic XEV304.'),
  mkStep('HAGER','DISJ-472',472,'Confirmation','escalade_hotline_hager_xev305','END','Contacter la hotline Hager au 09 69 39 07 12 pour escalade du diagnostic XEV305.'),
];
const hagerTransitions = {
  'DISJ-450':[{Libellé:'Monophasée',Valeur_collectée:'Monophasée',Next_Step_ID:'DISJ-451'},{Libellé:'Triphasée',Valeur_collectée:'Triphasée',Next_Step_ID:'DISJ-452'}],
  'DISJ-451':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-455'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-453'}],
  'DISJ-452':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-456'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-454'}],
  'DISJ-455':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-459'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-457'}],
  'DISJ-456':[{Libellé:'Conformes',Valeur_collectée:'Conformes',Next_Step_ID:'DISJ-460'},{Libellé:'Non conformes',Valeur_collectée:'Non conformes',Next_Step_ID:'DISJ-458'}],
  'DISJ-459':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-463'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-461'}],
  'DISJ-460':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-464'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-462'}],
  'DISJ-463':[{Libellé:'Oui',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-467'},{Libellé:'Non',Valeur_collectée:'Non',Next_Step_ID:'DISJ-465'}],
  'DISJ-464':[{Libellé:'Oui',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-468'},{Libellé:'Non',Valeur_collectée:'Non',Next_Step_ID:'DISJ-466'}],
  'DISJ-467':[{Libellé:'Oui – la puissance diminue',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-469'},{Libellé:'Non – la puissance ne diminue pas',Valeur_collectée:'Non',Next_Step_ID:'DISJ-471'}],
  'DISJ-468':[{Libellé:'Oui – la puissance diminue',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-470'},{Libellé:'Non – la puissance ne diminue pas',Valeur_collectée:'Non',Next_Step_ID:'DISJ-472'}],
};

function startHager(){ const app=harness(); load(app,hagerCatalogue,hagerSteps,hagerTransitions); app.run("startProcedure('HAGER')"); return app; }

function replayXev304(corrective, functional) {
  const app=startHager(); click(app,'Monophasée');
  click(app,corrective?'Non conforme':'Conforme'); if(corrective) confirm(app);
  click(app,corrective?'Non conforme':'Conforme'); if(corrective) confirm(app);
  click(app,corrective?'Non conforme':'Conforme'); if(corrective) confirm(app);
  click(app,corrective?'Non':'Oui'); if(corrective) confirm(app);
  click(app,functional?'Oui – la puissance diminue':'Non – la puissance ne diminue pas');
  return app;
}

function replayXev305(corrective, functional) {
  const app=startHager(); click(app,'Triphasée');
  click(app,corrective?'Non conforme':'Conforme'); if(corrective) confirm(app);
  click(app,corrective?'Non conformes':'Conformes'); if(corrective) confirm(app);
  click(app,corrective?'Non conforme':'Conforme'); if(corrective) confirm(app);
  click(app,corrective?'Non':'Oui'); if(corrective) confirm(app);
  click(app,functional?'Oui – la puissance diminue':'Non – la puissance ne diminue pas');
  return app;
}

test('XEV304 mono conform route never enters XEV305 and reaches functional end',()=>{
  const app=replayXev304(false,true);
  assert.equal(app.run('currentStepId'),'DISJ-469');
  assert.equal(collected(app,'type_alimentation_hager_xev'),'Monophasée');
  assert.equal(collected(app,'potentiometre_xev305_conforme'),undefined);
  assert.deepEqual(visited(app),['DISJ-450','DISJ-451','DISJ-455','DISJ-459','DISJ-463','DISJ-467']);
  confirm(app); assert.equal(app.get('final').classList.contains('hidden'),false);
});

test('XEV304 mono correction route rejoins controls and escalates to Hager',()=>{
  const app=replayXev304(true,false);
  assert.equal(app.run('currentStepId'),'DISJ-471');
  assert.match(app.get('question').textContent,/09 69 39 07 12/);
  assert.equal(visited(app).some(id=>['DISJ-452','DISJ-456','DISJ-460','DISJ-464','DISJ-468','DISJ-472'].includes(id)),false);
});

test('XEV305 tri conform route never enters XEV304 and reaches functional end',()=>{
  const app=replayXev305(false,true);
  assert.equal(app.run('currentStepId'),'DISJ-470');
  assert.equal(collected(app,'type_alimentation_hager_xev'),'Triphasée');
  assert.equal(collected(app,'potentiometre_xev304_conforme'),undefined);
  assert.deepEqual(visited(app),['DISJ-450','DISJ-452','DISJ-456','DISJ-460','DISJ-464','DISJ-468']);
  confirm(app); assert.equal(app.get('final').classList.contains('hidden'),false);
});

test('XEV305 tri correction route rejoins controls and escalates to Hager',()=>{
  const app=replayXev305(true,false);
  assert.equal(app.run('currentStepId'),'DISJ-472');
  assert.match(app.get('question').textContent,/09 69 39 07 12/);
  assert.equal(visited(app).some(id=>['DISJ-451','DISJ-455','DISJ-459','DISJ-463','DISJ-467','DISJ-471'].includes(id)),false);
});
