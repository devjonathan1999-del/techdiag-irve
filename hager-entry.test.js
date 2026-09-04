const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

const html=readFileSync(join(__dirname,'index.html'),'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

function app(){
  const elements=new Map();
  class E{
    constructor(id=''){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.style={};this.dataset={};const s=new Set();this.classList={add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)}}
    focus(){} setAttribute(n,v){this[n]=String(v)}
    querySelectorAll(q){assert.equal(q,'button');if(this.buttons&&this.markup===this.innerHTML)return this.buttons;this.markup=this.innerHTML;this.buttons=[...this.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const b=new E();b.dataset.i=m[1].match(/data-i="(\d+)"/)?.[1];b.textContent=m[2].replace(/<[^>]*>/g,'');return b});return this.buttons}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new E(id));return elements.get(id)};
  const ctx=vm.createContext({console,window:{},document:{getElementById:get},google:{charts:{load(){},setOnLoadCallback(){}}},alert:m=>{throw Error(m)}});
  vm.runInContext(script,ctx);
  const run=code=>vm.runInContext(code,ctx);
  const catalogue=[{Procedure_ID:'HAGER-ENTRY',Famille:'Diagnostic',Marque:'Hager',Titre:'Sélecteur gestion dynamique',Statut:'À valider'}];
  const steps=[
    {Procedure_ID:'HAGER-ENTRY',Step_ID:'DISJ-340',Ordre:340,Type_étape:'Question','Instruction / question':'Quel système de gestion dynamique est utilisé ?','Type_réponse':'Choix','Donnée_collectée':'gestion_dynamique_hager',Statut:'À valider'},
    {Procedure_ID:'HAGER-ENTRY',Step_ID:'DISJ-414',Ordre:414,Type_étape:'Question','Instruction / question':'TIC directe','Type_réponse':'Choix',Statut:'À valider'},
    {Procedure_ID:'HAGER-ENTRY',Step_ID:'DISJ-415',Ordre:415,Type_étape:'Question','Instruction / question':'Aucune gestion','Type_réponse':'Choix',Statut:'À valider'},
    {Procedure_ID:'HAGER-ENTRY',Step_ID:'DISJ-450',Ordre:450,Type_étape:'Question','Instruction / question':'XEV mono/tri','Type_réponse':'Choix',Statut:'À valider'},
  ];
  const trs={
    'DISJ-340':[
      {Libellé:'XEV304 / XEV305',Valeur_collectée:'XEV304 / XEV305',Next_Step_ID:'DISJ-450'},
      {Libellé:'TIC Linky directement vers la borne',Valeur_collectée:'TIC Linky directe',Next_Step_ID:'DISJ-414'},
      {Libellé:'Aucune gestion dynamique',Valeur_collectée:'Aucune gestion dynamique',Next_Step_ID:'DISJ-415'},
    ],
  };
  run(`catalogue=${JSON.stringify(catalogue)};steps=${JSON.stringify(steps)};catalogue.forEach(p=>catalogueByProcedure[p.Procedure_ID]=p);steps.forEach(s=>{byStep[s.Step_ID]=s;(byProcedure[s.Procedure_ID]??=[]).push(s)});Object.assign(transitionsByStep,${JSON.stringify(trs)});startProcedure('HAGER-ENTRY')`);
  return {get,run};
}

function choose(a,label){const c=a.get('controls'),bs=c.buttons||c.querySelectorAll('button'),b=bs.find(x=>x.textContent.includes(label));assert.ok(b);assert.equal(typeof b.onclick,'function');b.onclick()}

for(const [label,target,value] of [
  ['XEV304 / XEV305','DISJ-450','XEV304 / XEV305'],
  ['TIC Linky directement vers la borne','DISJ-414','TIC Linky directe'],
  ['Aucune gestion dynamique','DISJ-415','Aucune gestion dynamique'],
]){
  test(`DISJ-340 routes ${label} to ${target}`,()=>{const a=app();choose(a,label);assert.equal(a.run('currentStepId'),target);assert.equal(a.run('collected.gestion_dynamique_hager'),value)});
}
