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
    constructor(id='') {
      this.id=id; this.innerHTML=''; this.textContent=''; this.value=''; this.style={}; this.dataset={}; this.open=false;
      const classes=new Set();
      this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};
    }
    focus() {}
    setAttribute(name,value){this[name]=String(value)}
    querySelectorAll(selector){
      assert.equal(selector,'button');
      if(this.buttons&&this._markup===this.innerHTML)return this.buttons;
      this._markup=this.innerHTML;
      this.buttons=[...this.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{
        const b=new Element(); b.dataset.i=m[1].match(/data-i="(\d+)"/)?.[1]; b.textContent=m[2].replace(/<[^>]*>/g,''); return b;
      });
      return this.buttons;
    }
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const context=vm.createContext({console,window:{},document:{getElementById:get},google:{charts:{load(){},setOnLoadCallback(){}}},alert:m=>{throw Error(m)}});
  vm.runInContext(script,context);
  return {get,run:code=>vm.runInContext(code,context)};
}

function load(app,catalogue,steps,transitions){
  app.run(`catalogue=${JSON.stringify(catalogue)};steps=${JSON.stringify(steps)};
    catalogue.forEach(p=>catalogueByProcedure[p.Procedure_ID]=p);
    steps.forEach(s=>{byStep[s.Step_ID]=s;(byProcedure[s.Procedure_ID]??=[]).push(s)});
    Object.assign(transitionsByStep,${JSON.stringify(transitions)});`);
}

function click(app,label){
  const c=app.get('controls'), buttons=c.buttons||c.querySelectorAll('button');
  const b=buttons.find(x=>x.textContent.trim()===label||x.textContent.includes(label));
  assert.ok(b,`Choice not found: ${label}; got ${buttons.map(x=>x.textContent).join(' | ')}`);
  assert.equal(typeof b.onclick,'function'); b.onclick();
}
function confirm(app){assert.equal(typeof app.get('cont').onclick,'function');app.get('cont').onclick()}
function visited(app){return JSON.parse(app.run('JSON.stringify(reportLog.map(x=>x.stepId))'))}

const catalogue=[
  {Procedure_ID:'HAGER-TIC',Famille:'Diagnostic',Marque:'Hager',Titre:'TIC directe',Statut:'À valider'},
  {Procedure_ID:'HAGER-NONE',Famille:'Diagnostic',Marque:'Hager',Titre:'Aucune gestion dynamique',Statut:'À valider'},
];
const steps=[
  {Procedure_ID:'HAGER-TIC',Step_ID:'DISJ-414',Ordre:414,Type_étape:'Question','Instruction / question':'La liaison TIC est-elle correctement raccordée entre I1/I2 du Linky et la carte XEVA200 ?','Type_réponse':'Choix','Donnée_collectée':'raccordement_tic_directe_hager',Statut:'À valider'},
  {Procedure_ID:'HAGER-TIC',Step_ID:'DISJ-426',Ordre:426,Type_étape:'Action','Instruction / question':'Corriger le raccordement TIC.','Type_réponse':'Confirmation',Next_OK:'DISJ-427','Donnée_collectée':'correction_raccordement_tic_directe_hager',Statut:'À valider'},
  {Procedure_ID:'HAGER-TIC',Step_ID:'DISJ-427',Ordre:427,Type_étape:'Question','Instruction / question':'La continuité des deux conducteurs TIC est-elle conforme ?','Type_réponse':'Choix','Donnée_collectée':'continuite_tic_directe_hager',Statut:'À valider'},
  {Procedure_ID:'HAGER-TIC',Step_ID:'DISJ-428',Ordre:428,Type_étape:'Action','Instruction / question':'Corriger ou remplacer la liaison TIC défectueuse.','Type_réponse':'Confirmation',Next_OK:'DISJ-429','Donnée_collectée':'correction_continuite_tic_directe_hager',Statut:'À valider'},
  {Procedure_ID:'HAGER-TIC',Step_ID:'DISJ-429',Ordre:429,Type_étape:'Question','Instruction / question':'Le délestage TIC adapte-t-il correctement la puissance de charge ?','Type_réponse':'Choix','Donnée_collectée':'test_delestage_tic_directe_hager',Statut:'À valider'},
  {Procedure_ID:'HAGER-TIC',Step_ID:'DISJ-430',Ordre:430,Type_étape:'Orientation','Instruction / question':'Gestion dynamique TIC directe fonctionnelle.','Type_réponse':'Information',Next_OK:'END','Donnée_collectée':'delestage_tic_directe_hager_fonctionnel',Statut:'À valider'},
  {Procedure_ID:'HAGER-TIC',Step_ID:'DISJ-431',Ordre:431,Type_étape:'Action','Instruction / question':'Contacter la hotline Hager au 09 69 39 07 12 pour escalade du diagnostic.','Type_réponse':'Confirmation',Next_OK:'END','Donnée_collectée':'escalade_hotline_hager_tic_directe',Statut:'À valider'},

  {Procedure_ID:'HAGER-NONE',Step_ID:'DISJ-415',Ordre:415,Type_étape:'Question','Instruction / question':'Un système de gestion dynamique était-il prévu sur cette installation Hager ?','Type_réponse':'Choix','Donnée_collectée':'gestion_dynamique_hager_prevue',Statut:'À valider'},
  {Procedure_ID:'HAGER-NONE',Step_ID:'DISJ-432',Ordre:432,Type_étape:'Question','Instruction / question':'Quel système de gestion dynamique était prévu sur l’installation ?','Type_réponse':'Choix','Donnée_collectée':'systeme_gestion_hager_prevu',Statut:'À valider'},
  {Procedure_ID:'HAGER-NONE',Step_ID:'DISJ-433',Ordre:433,Type_étape:'Conclusion','Instruction / question':'Aucune gestion dynamique n’était prévue : la borne Hager ne peut pas adapter automatiquement sa puissance à la consommation du logement dans ce contexte.','Type_réponse':'Information',Next_OK:'DISJ-434','Donnée_collectée':'conclusion_sans_gestion_hager',Statut:'À valider'},
  {Procedure_ID:'HAGER-NONE',Step_ID:'DISJ-434',Ordre:434,Type_étape:'Action','Instruction / question':'Adapter l’installation. Aucun remplacement automatique de la borne n’est justifié par la seule absence de gestion dynamique.','Type_réponse':'Confirmation',Next_OK:'END','Donnée_collectée':'adaptation_installation_sans_gestion_hager',Statut:'À valider'},

  {Procedure_ID:'HAGER-NONE',Step_ID:'DISJ-450',Ordre:450,Type_étape:'Question','Instruction / question':'Quel est le type d’alimentation de l’installation Hager ?','Type_réponse':'Choix','Donnée_collectée':'type_alimentation_hager_xev',Statut:'À valider'},
  {Procedure_ID:'HAGER-NONE',Step_ID:'DISJ-451',Ordre:451,Type_étape:'Question','Instruction / question':'XEV304 mono','Type_réponse':'Choix',Statut:'À valider'},
].sort((a,b)=>a.Ordre-b.Ordre);

const transitions={
  'DISJ-414':[
    {Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-427'},
    {Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-426'},
  ],
  'DISJ-427':[
    {Libellé:'Oui – continuité conforme',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-429'},
    {Libellé:'Non – continuité non conforme',Valeur_collectée:'Non',Next_Step_ID:'DISJ-428'},
  ],
  'DISJ-429':[
    {Libellé:'Oui – délestage fonctionnel',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-430'},
    {Libellé:'Non – délestage non fonctionnel',Valeur_collectée:'Non',Next_Step_ID:'DISJ-431'},
  ],
  'DISJ-415':[
    {Libellé:'Oui, un système était prévu',Valeur_collectée:'Gestion prévue',Next_Step_ID:'DISJ-432'},
    {Libellé:'Non, l’installation a été conçue sans gestion dynamique',Valeur_collectée:'Sans gestion dynamique',Next_Step_ID:'DISJ-433'},
  ],
  'DISJ-432':[
    {Libellé:'XEV304 / XEV305 – Module de gestion dynamique',Valeur_collectée:'XEV304 / XEV305',Next_Step_ID:'DISJ-450'},
    {Libellé:'TIC Linky directement vers la borne',Valeur_collectée:'TIC Linky directe',Next_Step_ID:'DISJ-414'},
  ],
  'DISJ-450':[
    {Libellé:'Monophasée',Valeur_collectée:'Monophasée',Next_Step_ID:'DISJ-451'},
    {Libellé:'Triphasée',Valeur_collectée:'Triphasée',Next_Step_ID:'DISJ-451'},
  ],
};

test('Hager direct TIC conform route reaches functional end',()=>{
  const app=harness();load(app,catalogue,steps,transitions);app.run("startProcedure('HAGER-TIC')");
  click(app,'Conforme'); click(app,'Oui – continuité conforme'); click(app,'Oui – délestage fonctionnel');
  assert.equal(app.run('currentStepId'),'DISJ-430');
  assert.deepEqual(visited(app),['DISJ-414','DISJ-427','DISJ-429']);
  confirm(app); assert.equal(app.get('final').classList.contains('hidden'),false);
});

test('Hager direct TIC correction route can escalate without replacement',()=>{
  const app=harness();load(app,catalogue,steps,transitions);app.run("startProcedure('HAGER-TIC')");
  click(app,'Non conforme'); assert.equal(app.run('currentStepId'),'DISJ-426'); confirm(app);
  click(app,'Non – continuité non conforme'); assert.equal(app.run('currentStepId'),'DISJ-428'); confirm(app);
  click(app,'Non – délestage non fonctionnel');
  assert.equal(app.run('currentStepId'),'DISJ-431');
  assert.match(app.get('question').textContent,/09 69 39 07 12/);
});

test('Hager without planned dynamic management ends on installation adaptation',()=>{
  const app=harness();load(app,catalogue,steps,transitions);app.run("startProcedure('HAGER-NONE')");
  click(app,'Non, l’installation a été conçue sans gestion dynamique');
  assert.equal(app.run('currentStepId'),'DISJ-433'); confirm(app);
  assert.equal(app.run('currentStepId'),'DISJ-434');
  assert.match(app.get('question').textContent,/Aucun remplacement automatique/);
  confirm(app); assert.equal(app.get('final').classList.contains('hidden'),false);
});

test('Hager missing intended management can route back to XEV branch',()=>{
  const app=harness();load(app,catalogue,steps,transitions);app.run("startProcedure('HAGER-NONE')");
  click(app,'Oui, un système était prévu'); assert.equal(app.run('currentStepId'),'DISJ-432');
  click(app,'XEV304 / XEV305 – Module de gestion dynamique');
  assert.equal(app.run('currentStepId'),'DISJ-450');
});

test('Hager missing intended management can route back to direct TIC branch',()=>{
  const app=harness();load(app,catalogue,steps,transitions);app.run("startProcedure('HAGER-NONE')");
  click(app,'Oui, un système était prévu'); click(app,'TIC Linky directement vers la borne');
  assert.equal(app.run('currentStepId'),'DISJ-414');
});
