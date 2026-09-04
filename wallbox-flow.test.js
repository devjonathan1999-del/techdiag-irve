const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

const html=readFileSync(join(__dirname,'index.html'),'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

function harness(){
  const elements=new Map();
  class E{
    constructor(id=''){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.style={};this.dataset={};this.open=false;const s=new Set();this.classList={add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)}}
    focus(){} setAttribute(n,v){this[n]=String(v)}
    querySelectorAll(q){assert.equal(q,'button');if(this.buttons&&this.markup===this.innerHTML)return this.buttons;this.markup=this.innerHTML;this.buttons=[...this.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const b=new E();b.dataset.i=m[1].match(/data-i="(\d+)"/)?.[1];b.textContent=m[2].replace(/<[^>]*>/g,'');return b});return this.buttons}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new E(id));return elements.get(id)};
  const ctx=vm.createContext({console,window:{},document:{getElementById:get},google:{charts:{load(){},setOnLoadCallback(){}}},alert:m=>{throw Error(m)}});
  vm.runInContext(script,ctx);
  return {get,run:code=>vm.runInContext(code,ctx)};
}

function step(id,order,type,response,key,next='',question=id,value=''){
  return {Procedure_ID:'WBX',Step_ID:id,Ordre:order,Type_étape:type,'Instruction / question':question,'Type_réponse':response,'Valeur / choix attendu':value,Next_OK:next,'Donnée_collectée':key,Statut:'À valider'};
}

const catalogue=[{Procedure_ID:'WBX',Famille:'Diagnostic',Marque:'Wallbox',Titre:'Power Boost',Statut:'À valider'}];
const steps=[
  step('DISJ-350',350,'Question','Choix','compteur_power_boost_wallbox','','Quel compteur est utilisé pour le Power Boost Wallbox ?'),
  step('DISJ-435',435,'Question','Choix','implantation_n1ct_powerboost'),
  step('DISJ-436',436,'Question','Choix','implantation_em112_powerboost'),
  step('DISJ-437',437,'Question','Choix','implantation_em340_powerboost'),
  step('DISJ-438',438,'Question','Choix','implantation_em330_powerboost'),
  step('DISJ-439',439,'Action','Confirmation','correction_implantation_powerboost','DISJ-440'),
  step('DISJ-440',440,'Question','Choix','liaison_communication_powerboost'),
  step('DISJ-441',441,'Action','Confirmation','correction_liaison_powerboost','DISJ-442'),
  step('DISJ-442',442,'Question','Choix','switch_rs485_wallbox_t'),
  step('DISJ-443',443,'Action','Confirmation','correction_switch_rs485_wallbox','DISJ-444'),
  step('DISJ-444',444,'Question','Choix','reglage_courant_powerboost'),
  step('DISJ-445',445,'Action','Confirmation','correction_reglage_powerboost','DISJ-447'),
  step('DISJ-446',446,'Action','Confirmation','absence_gestion_dynamique_wallbox','END','Aucune gestion dynamique Wallbox n’est installée. Adapter l’installation : ajouter un Power Boost compatible ou limiter la puissance de charge à la puissance disponible de l’installation.','Installation à adapter'),
  step('DISJ-447',447,'Question','Choix','test_fonctionnel_powerboost'),
  step('DISJ-448',448,'Orientation','Information','powerboost_fonctionnel','END','Gestion dynamique Wallbox Power Boost fonctionnelle.','Power Boost fonctionnel'),
  step('DISJ-449',449,'Action','Confirmation','escalade_powerboost_wallbox','END','Power Boost ne réagit pas malgré une implantation, une liaison de communication, un switch RS485 et un réglage conformes : escalader le dossier au support Wallbox. Ne pas conclure automatiquement à un remplacement de la borne.'),
];
const transitions={
  'DISJ-350':[
    {Libellé:'N1CT',Valeur_collectée:'N1CT',Next_Step_ID:'DISJ-435'},
    {Libellé:'EM112',Valeur_collectée:'EM112',Next_Step_ID:'DISJ-436'},
    {Libellé:'EM340',Valeur_collectée:'EM340',Next_Step_ID:'DISJ-437'},
    {Libellé:'EM330',Valeur_collectée:'EM330',Next_Step_ID:'DISJ-438'},
    {Libellé:'Aucune gestion dynamique',Valeur_collectée:'Aucune gestion dynamique',Next_Step_ID:'DISJ-446'},
  ],
  'DISJ-435':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-440'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-439'}],
  'DISJ-436':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-440'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-439'}],
  'DISJ-437':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-440'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-439'}],
  'DISJ-438':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-440'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-439'}],
  'DISJ-440':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-442'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-441'}],
  'DISJ-442':[{Libellé:'Oui',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-444'},{Libellé:'Non',Valeur_collectée:'Non',Next_Step_ID:'DISJ-443'}],
  'DISJ-444':[{Libellé:'Conforme',Valeur_collectée:'Conforme',Next_Step_ID:'DISJ-447'},{Libellé:'Non conforme',Valeur_collectée:'Non conforme',Next_Step_ID:'DISJ-445'}],
  'DISJ-447':[{Libellé:'Oui – Power Boost adapte la puissance',Valeur_collectée:'Oui',Next_Step_ID:'DISJ-448'},{Libellé:'Non – Power Boost ne réagit pas',Valeur_collectée:'Non',Next_Step_ID:'DISJ-449'}],
};

function start(){const a=harness();a.run(`catalogue=${JSON.stringify(catalogue)};steps=${JSON.stringify(steps)};catalogue.forEach(p=>catalogueByProcedure[p.Procedure_ID]=p);steps.forEach(s=>{byStep[s.Step_ID]=s;(byProcedure[s.Procedure_ID]??=[]).push(s)});Object.assign(transitionsByStep,${JSON.stringify(transitions)});startProcedure('WBX')`);return a}
function click(a,label){const c=a.get('controls'),bs=c.buttons||c.querySelectorAll('button'),b=bs.find(x=>x.textContent.trim()===label||x.textContent.includes(label));assert.ok(b,`Missing ${label}; got ${bs.map(x=>x.textContent).join(' | ')}`);assert.equal(typeof b.onclick,'function');b.onclick()}
function confirm(a){assert.equal(typeof a.get('cont').onclick,'function',`No Continue button at ${a.run('currentStepId')}`);a.get('cont').onclick()}

for(const [meter,target] of [['N1CT','DISJ-435'],['EM112','DISJ-436'],['EM340','DISJ-437'],['EM330','DISJ-438']]){
  test(`Wallbox ${meter} enters the right implantation control`,()=>{const a=start();click(a,meter);assert.equal(a.run('currentStepId'),target);assert.equal(a.run('collected.compteur_power_boost_wallbox'),meter)});
}

test('Wallbox conform Power Boost route reaches functional conclusion',()=>{
  const a=start();click(a,'N1CT');click(a,'Conforme');click(a,'Conforme');click(a,'Oui');click(a,'Conforme');click(a,'Oui – Power Boost adapte la puissance');
  assert.equal(a.run('currentStepId'),'DISJ-448');confirm(a);assert.equal(a.get('final').classList.contains('hidden'),false);
});

test('Wallbox correction route rejoins every common control then escalates',()=>{
  const a=start();click(a,'EM340');click(a,'Non conforme');assert.equal(a.run('currentStepId'),'DISJ-439');confirm(a);
  click(a,'Non conforme');assert.equal(a.run('currentStepId'),'DISJ-441');confirm(a);
  click(a,'Non');assert.equal(a.run('currentStepId'),'DISJ-443');confirm(a);
  click(a,'Non conforme');assert.equal(a.run('currentStepId'),'DISJ-445');confirm(a);
  click(a,'Non – Power Boost ne réagit pas');assert.equal(a.run('currentStepId'),'DISJ-449');assert.match(a.get('question').textContent,/support Wallbox/);assert.match(a.get('question').textContent,/Ne pas conclure automatiquement/);
});

test('Wallbox no dynamic management is an information/action screen with Continue, not free text',()=>{
  const a=start();click(a,'Aucune gestion dynamique');assert.equal(a.run('currentStepId'),'DISJ-446');
  assert.equal(typeof a.get('cont').onclick,'function','DISJ-446 must render a Continue button');
  assert.equal(a.get('controls').innerHTML.includes('textarea'),false,'DISJ-446 must not request arbitrary text');
  confirm(a);assert.equal(a.get('final').classList.contains('hidden'),false);
});
