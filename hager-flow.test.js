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
      this.value = '';
      this.style = {};
      this.dataset = {};
      this.open = false;
      this.hidden = false;
      const classes = new Set();
      this.classList = {
        add: x => classes.add(x),
        remove: x => classes.delete(x),
        contains: x => classes.has(x),
      };
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
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const context = vm.createContext({
    console,
    window: {},
    document: { getElementById: get },
    google: { charts: { load() {}, setOnLoadCallback() {} } },
    alert: message => { throw Error(message); },
  });
  vm.runInContext(script, context);
  return { get, run: code => vm.runInContext(code, context) };
}

function loadFixture(app, catalogue, steps, transitions) {
  app.run(`
    catalogue=${JSON.stringify(catalogue)};
    steps=${JSON.stringify(steps)};
    catalogue.forEach(p=>catalogueByProcedure[p.Procedure_ID]=p);
    steps.forEach(s=>{byStep[s.Step_ID]=s;(byProcedure[s.Procedure_ID]??=[]).push(s)});
    Object.assign(transitionsByStep, ${JSON.stringify(transitions)});
  `);
}

function clickChoice(app, text) {
  const buttons = app.get('controls').querySelectorAll('button');
  const button = buttons.find(x => x.textContent.trim() === text || x.textContent.includes(text));
  assert.ok(button, `Choice not found: ${text}. Available: ${buttons.map(x => x.textContent).join(' | ')}`);
  button.onclick();
}

const powerCatalogue = [
  { Procedure_ID:'POWER-REPLAY', Famille:'Diagnostic', Marque:'IRVE', Titre:'Puissance souscrite', Statut:'À valider' },
];

const powerSteps = [
  { Procedure_ID:'POWER-REPLAY', Step_ID:'DISJ-090', Ordre:90, Type_étape:'Question', 'Instruction / question':'L’installation est-elle monophasée ou triphasée ?', 'Type_réponse':'Choix', 'Donnée_collectée':'type_alimentation', Statut:'À valider' },
  { Procedure_ID:'POWER-REPLAY', Step_ID:'DISJ-100', Ordre:100, Type_étape:'Question', 'Instruction / question':'Quelle est la puissance souscrite du logement monophasé ?', 'Type_réponse':'Choix', 'Donnée_collectée':'puissance_souscrite', Statut:'À valider' },
  { Procedure_ID:'POWER-REPLAY', Step_ID:'DISJ-105', Ordre:105, Type_étape:'Question', 'Instruction / question':'Quelle est la puissance souscrite du logement triphasé ?', 'Type_réponse':'Choix', 'Donnée_collectée':'puissance_souscrite', Statut:'À valider' },
  { Procedure_ID:'POWER-REPLAY', Step_ID:'DISJ-109', Ordre:109, Type_étape:'Collecte', 'Instruction / question':'Saisir la puissance souscrite indiquée sur le contrat ou le compteur Linky.', 'Type_réponse':'Numérique / observation', Next_OK:'DISJ-110', 'Donnée_collectée':'puissance_souscrite', Statut:'À valider' },
  { Procedure_ID:'POWER-REPLAY', Step_ID:'DISJ-110', Ordre:110, Type_étape:'Action', 'Instruction / question':'Étape suivante', 'Type_réponse':'Confirmation', Next_OK:'END', Statut:'À valider' },
];

const powerTransitions = {
  'DISJ-090': [
    { Libellé:'Monophasée', Valeur_collectée:'Monophasée', Next_Step_ID:'DISJ-100' },
    { Libellé:'Triphasée', Valeur_collectée:'Triphasée', Next_Step_ID:'DISJ-105' },
  ],
  'DISJ-100': [
    ...[3,6,9,12,15].map(kva => ({ Libellé:`${kva} kVA`, Valeur_collectée:`${kva} kVA`, Next_Step_ID:'DISJ-110' })),
    { Libellé:'Autre', Valeur_collectée:'Autre', Next_Step_ID:'DISJ-109' },
  ],
  'DISJ-105': [
    ...[6,9,12,15,18,24,30,36].map(kva => ({ Libellé:`${kva} kVA`, Valeur_collectée:`${kva} kVA`, Next_Step_ID:'DISJ-110' })),
    { Libellé:'Autre', Valeur_collectée:'Autre', Next_Step_ID:'DISJ-109' },
  ],
};

const hagerCatalogue = [
  { Procedure_ID:'HAGER-REPLAY', Famille:'Diagnostic', Marque:'Hager', Titre:'Installation générale disjoncte — XEV', Statut:'À valider' },
];

const hagerSteps = [
  ['DISJ-450',450,'Question','Quel est le type d’alimentation de l’installation Hager ?','Choix','type_alimentation_hager_xev'],
  ['DISJ-451',451,'Question','Le potentiomètre du XEV304 est-il réglé conformément à la puissance souscrite de l’installation ?','Choix','potentiometre_xev304_conforme'],
  ['DISJ-452',452,'Question','Le potentiomètre du XEV305 est-il réglé conformément à la puissance souscrite de l’installation ?','Choix','potentiometre_xev305_conforme'],
  ['DISJ-453',453,'Action','Régler le potentiomètre du XEV304 conformément à la puissance souscrite de l’installation, puis poursuivre le diagnostic.','Confirmation','correction_potentiometre_xev304','DISJ-455'],
  ['DISJ-454',454,'Action','Régler le potentiomètre du XEV305 conformément à la puissance souscrite de l’installation, puis poursuivre le diagnostic.','Confirmation','correction_potentiometre_xev305','DISJ-456'],
  ['DISJ-455',455,'Question','Le tore de mesure du XEV304 est-il correctement installé pour mesurer la consommation totale de l’installation ?','Choix','tore_xev304_conforme'],
  ['DISJ-456',456,'Question','Les tores de mesure du XEV305 sont-ils correctement installés pour mesurer la consommation totale de l’installation triphasée ?','Choix','tores_xev305_conformes'],
  ['DISJ-457',457,'Action','Corriger l’implantation ou le raccordement du tore de mesure du XEV304 avant de poursuivre.','Confirmation','correction_tore_xev304','DISJ-459'],
  ['DISJ-458',458,'Action','Corriger l’implantation ou le raccordement des tores de mesure du XEV305 avant de poursuivre.','Confirmation','correction_tores_xev305','DISJ-460'],
  ['DISJ-459',459,'Question','La liaison TIC entre le XEV304 et la borne est-elle conforme ?','Choix','liaison_tic_xev304_conforme'],
  ['DISJ-460',460,'Question','La liaison TIC entre le XEV305 et la borne est-elle conforme ?','Choix','liaison_tic_xev305_conforme'],
  ['DISJ-461',461,'Action','Corriger la liaison TIC entre le XEV304 et la borne avant de poursuivre.','Confirmation','correction_liaison_tic_xev304','DISJ-463'],
  ['DISJ-462',462,'Action','Corriger la liaison TIC entre le XEV305 et la borne avant de poursuivre.','Confirmation','correction_liaison_tic_xev305','DISJ-464'],
  ['DISJ-463',463,'Question','La borne reliée au XEV304 est-elle équipée d’une carte TIC XEVA200 ou XEVA205 ?','Choix','carte_tic_xev304_presente'],
  ['DISJ-464',464,'Question','La borne reliée au XEV305 est-elle équipée d’une carte TIC XEVA200 ou XEVA205 ?','Choix','carte_tic_xev305_presente'],
  ['DISJ-465',465,'Action','Remettre en place une carte TIC XEVA200 ou XEVA205 compatible avant de poursuivre le diagnostic du XEV304.','Confirmation','correction_carte_tic_xev304','DISJ-467'],
  ['DISJ-466',466,'Action','Remettre en place une carte TIC XEVA200 ou XEVA205 compatible avant de poursuivre le diagnostic du XEV305.','Confirmation','correction_carte_tic_xev305','DISJ-468'],
  ['DISJ-467',467,'Question','Réduire temporairement le réglage du potentiomètre du XEV304, puis relancer la charge. La puissance de charge diminue-t-elle ?','Choix','test_reduction_potentiometre_xev304'],
  ['DISJ-468',468,'Question','Réduire temporairement le réglage du potentiomètre du XEV305, puis relancer la charge. La puissance de charge diminue-t-elle ?','Choix','test_reduction_potentiometre_xev305'],
  ['DISJ-469',469,'Action','Remettre le potentiomètre du XEV304 à sa valeur initiale conforme.','Confirmation','delestage_xev304_fonctionnel','END'],
  ['DISJ-470',470,'Action','Remettre le potentiomètre du XEV305 à sa valeur initiale conforme.','Confirmation','delestage_xev305_fonctionnel','END'],
  ['DISJ-471',471,'Action','Contacter la hotline Hager au 09 69 39 07 12 pour escalade du diagnostic XEV304.','Confirmation','escalade_hotline_hager_xev304','END'],
  ['DISJ-472',472,'Action','Contacter la hotline Hager au 09 69 39 07 12 pour escalade du diagnostic XEV305.','Confirmation','escalade_hotline_hager_xev305','END'],
].map(([Step_ID,Ordre,Type_étape,question,typeResponse,key,next]) => ({
  Procedure_ID:'HAGER-REPLAY', Step_ID, Ordre, Type_étape,
  'Instruction / question':question, 'Type_réponse':typeResponse,
  'Donnée_collectée':key, Next_OK:next || '', Statut:'À valider',
}));

const hagerTransitions = {
  'DISJ-450': [
    { Libellé:'Monophasée', Valeur_collectée:'Monophasée', Next_Step_ID:'DISJ-451' },
    { Libellé:'Triphasée', Valeur_collectée:'Triphasée', Next_Step_ID:'DISJ-452' },
  ],
  'DISJ-451': [
    { Libellé:'Conforme', Valeur_collectée:'Conforme', Next_Step_ID:'DISJ-455' },
    { Libellé:'Non conforme', Valeur_collectée:'Non conforme', Next_Step_ID:'DISJ-453' },
  ],
  'DISJ-452': [
    { Libellé:'Conforme', Valeur_collectée:'Conforme', Next_Step_ID:'DISJ-456' },
    { Libellé:'Non conforme', Valeur_collectée:'Non conforme', Next_Step_ID:'DISJ-454' },
  ],
  'DISJ-455': [
    { Libellé:'Conforme', Valeur_collectée:'Conforme', Next_Step_ID:'DISJ-459' },
    { Libellé:'Non conforme', Valeur_collectée:'Non conforme', Next_Step_ID:'DISJ-457' },
  ],
  'DISJ-456': [
    { Libellé:'Conformes', Valeur_collectée:'Conformes', Next_Step_ID:'DISJ-460' },
    { Libellé:'Non conformes', Valeur_collectée:'Non conformes', Next_Step_ID:'DISJ-458' },
  ],
  'DISJ-459': [
    { Libellé:'Conforme', Valeur_collectée:'Conforme', Next_Step_ID:'DISJ-463' },
    { Libellé:'Non conforme', Valeur_collectée:'Non conforme', Next_Step_ID:'DISJ-461' },
  ],
  'DISJ-460': [
    { Libellé:'Conforme', Valeur_collectée:'Conforme', Next_Step_ID:'DISJ-464' },
    { Libellé:'Non conforme', Valeur_collectée:'Non conforme', Next_Step_ID:'DISJ-462' },
  ],
  'DISJ-463': [
    { Libellé:'Oui', Valeur_collectée:'Oui', Next_Step_ID:'DISJ-467' },
    { Libellé:'Non', Valeur_collectée:'Non', Next_Step_ID:'DISJ-465' },
  ],
  'DISJ-464': [
    { Libellé:'Oui', Valeur_collectée:'Oui', Next_Step_ID:'DISJ-468' },
    { Libellé:'Non', Valeur_collectée:'Non', Next_Step_ID:'DISJ-466' },
  ],
  'DISJ-467': [
    { Libellé:'Oui – la puissance diminue', Valeur_collectée:'Oui', Next_Step_ID:'DISJ-469' },
    { Libellé:'Non – la puissance ne diminue pas', Valeur_collectée:'Non', Next_Step_ID:'DISJ-471' },
  ],
  'DISJ-468': [
    { Libellé:'Oui – la puissance diminue', Valeur_collectée:'Oui', Next_Step_ID:'DISJ-470' },
    { Libellé:'Non – la puissance ne diminue pas', Valeur_collectée:'Non', Next_Step_ID:'DISJ-472' },
  ],
};

function startHager() {
  const app = harness();
  loadFixture(app, hagerCatalogue, hagerSteps, hagerTransitions);
  app.run("startProcedure('HAGER-REPLAY')");
  assert.equal(app.run('currentStepId'), 'DISJ-450');
  return app;
}

function confirm(app) {
  assert.equal(typeof app.get('cont').onclick, 'function', `No confirmation handler at ${app.run('currentStepId')}`);
  app.get('cont').onclick();
}

function visited(app) {
  return JSON.parse(app.run('JSON.stringify(reportLog.map(x=>x.stepId))'));
}

test('DISJ-100 power buttons keep puissance_souscrite and only show mono values', () => {
  const app = harness();
  loadFixture(app, powerCatalogue, powerSteps, powerTransitions);
  app.run("startProcedure('POWER-REPLAY')");
  clickChoice(app, 'Monophasée');
  assert.equal(app.run('currentStepId'), 'DISJ-100');
  const labels = app.get('controls').querySelectorAll('button').map(x => x.textContent.trim());
  assert.deepEqual(labels, ['3 kVA','6 kVA','9 kVA','12 kVA','15 kVA','Autre']);
  clickChoice(app, '9 kVA');
  assert.equal(app.run('currentStepId'), 'DISJ-110');
  assert.equal(app.run('collected.type_alimentation'), 'Monophasée');
  assert.equal(app.run('collected.puissance_souscrite'), '9 kVA');
});

test('DISJ-105 power buttons only show tri values and Autre overwrites the fallback value', () => {
  const app = harness();
  loadFixture(app, powerCatalogue, powerSteps, powerTransitions);
  app.run("startProcedure('POWER-REPLAY')");
  clickChoice(app, 'Triphasée');
  assert.equal(app.run('currentStepId'), 'DISJ-105');
  const labels = app.get('controls').querySelectorAll('button').map(x => x.textContent.trim());
  assert.deepEqual(labels, ['6 kVA','9 kVA','12 kVA','15 kVA','18 kVA','24 kVA','30 kVA','36 kVA','Autre']);
  clickChoice(app, 'Autre');
  assert.equal(app.run('currentStepId'), 'DISJ-109');
  app.get('txt').value = '20';
  app.get('txtok').onclick();
  assert.equal(app.run('currentStepId'), 'DISJ-110');
  assert.equal(app.run('collected.type_alimentation'), 'Triphasée');
  assert.equal(app.run('collected.puissance_souscrite'), '20');
});

test('Hager XEV304 mono all-conform route stays mono and ends functional', () => {
  const app = startHager();
  clickChoice(app, 'Monophasée');
  for (const choice of ['Conforme','Conforme','Conforme','Oui','Oui – la puissance diminue']) clickChoice(app, choice);
  assert.equal(app.run('currentStepId'), 'DISJ-469');
  assert.deepEqual(visited(app), ['DISJ-450','DISJ-451','DISJ-455','DISJ-459','DISJ-463','DISJ-467']);
  assert.equal(app.run('collected.type_alimentation_hager_xev'), 'Monophasée');
  assert.equal(app.run('typeof collected.potentiometre_xev305_conforme'), 'undefined');
  confirm(app);
  assert.equal(app.get('final').classList.contains('hidden'), false);
});

test('Hager XEV304 mono correction route rejoins each control and escalates without XEV305', () => {
  const app = startHager();
  clickChoice(app, 'Monophasée');
  clickChoice(app, 'Non conforme'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-455');
  clickChoice(app, 'Non conforme'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-459');
  clickChoice(app, 'Non conforme'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-463');
  clickChoice(app, 'Non'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-467');
  clickChoice(app, 'Non – la puissance ne diminue pas');
  assert.equal(app.run('currentStepId'), 'DISJ-471');
  assert.match(app.get('question').textContent, /09 69 39 07 12/);
  assert.equal(visited(app).some(id => ['DISJ-452','DISJ-456','DISJ-460','DISJ-464','DISJ-468','DISJ-472'].includes(id)), false);
});

test('Hager XEV305 tri all-conform route stays tri and ends functional', () => {
  const app = startHager();
  clickChoice(app, 'Triphasée');
  for (const choice of ['Conforme','Conformes','Conforme','Oui','Oui – la puissance diminue']) clickChoice(app, choice);
  assert.equal(app.run('currentStepId'), 'DISJ-470');
  assert.deepEqual(visited(app), ['DISJ-450','DISJ-452','DISJ-456','DISJ-460','DISJ-464','DISJ-468']);
  assert.equal(app.run('collected.type_alimentation_hager_xev'), 'Triphasée');
  assert.equal(app.run('typeof collected.potentiometre_xev304_conforme'), 'undefined');
  confirm(app);
  assert.equal(app.get('final').classList.contains('hidden'), false);
});

test('Hager XEV305 tri correction route rejoins each control and escalates without XEV304', () => {
  const app = startHager();
  clickChoice(app, 'Triphasée');
  clickChoice(app, 'Non conforme'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-456');
  clickChoice(app, 'Non conformes'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-460');
  clickChoice(app, 'Non conforme'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-464');
  clickChoice(app, 'Non'); confirm(app);
  assert.equal(app.run('currentStepId'), 'DISJ-468');
  clickChoice(app, 'Non – la puissance ne diminue pas');
  assert.equal(app.run('currentStepId'), 'DISJ-472');
  assert.match(app.get('question').textContent, /09 69 39 07 12/);
  assert.equal(visited(app).some(id => ['DISJ-451','DISJ-455','DISJ-459','DISJ-463','DISJ-467','DISJ-471'].includes(id)), false);
});
