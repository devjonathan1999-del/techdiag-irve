const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Run after build.js. Exercise the built application and its real summary
// wrapper together. Only the DOM/clipboard/network boundaries are substituted.
const html = fs.readFileSync(path.join(__dirname, 'dist/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function harness({ clipboardFails = false, fallbackWorks = true } = {}) {
  const elements = new Map(), writes = [], timers = new Map();
  let selectedText = '', timerId = 0;
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.style = {}; this.className = ''; this.textContent = ''; this.innerHTML = ''; this.value = ''; }
    get classList() {
      return { add: name => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), name])].join(' '); },
        remove: name => { this.className = this.className.split(' ').filter(x => x !== name).join(' '); },
        contains: name => this.className.split(' ').includes(name) };
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); if (child.id) elements.set(child.id, child); return child; }
    insertBefore(child, sibling) {
      child.parentNode = this; const i = this.children.indexOf(sibling);
      this.children.splice(i < 0 ? this.children.length : i, 0, child);
      if (child.id) elements.set(child.id, child); return child;
    }
    get firstChild() { return this.children[0] || null; }
    querySelector(selector) { assert.equal(selector, '.btns'); return this.children.find(x => x.classList.contains('btns')) || null; }
    setAttribute(key, value) { this[key] = String(value); }
    focus() {}
    select() { selectedText = this.value; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
  }
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) { const el = new Element(); el.id = match[1]; elements.set(el.id, el); }
  const final = elements.get('final'), buttons = new Element(); buttons.className = 'btns'; final.appendChild(buttons);
  const restart = new Element('button'); restart.textContent = 'Nouveau diagnostic'; buttons.appendChild(restart);
  const body = new Element('body'); body.appendChild(final);
  const context = vm.createContext({ console, URL, window: {},
    document: { getElementById: id => elements.get(id) || null, createElement: tag => new Element(tag), body,
      execCommand: command => { assert.equal(command, 'copy'); if (fallbackWorks) writes.push(selectedText); return fallbackWorks; } },
    google: { charts: { load() {}, setOnLoadCallback() {} } },
    navigator: { clipboard: { async writeText(value) { if (clipboardFails) throw Error('Clipboard unavailable'); writes.push(value); } } },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  scripts.forEach(script => vm.runInContext(script, context));
  const run = code => vm.runInContext(code, context);
  run(`activeProcedureId='A';activeProcedureTitle='Borne bleue';currentStepId='A-END';
    catalogueByProcedure={A:{Titre:'Borne bleue',Statut:'En construction'},B:{Titre:'Planification',Statut:'Validé TechDiag'}};
    byStep={'A-END':{Procedure_ID:'A',Step_ID:'A-END',Statut:'À valider'}};
    reportLog=[{stepId:'A-010',question:'Question initiale ?',answer:'Oui'},{stepId:'A-END',question:'Essai final ?',answer:'Confirmé'}];
    collected={cable_t2:'Conforme',mesure:0,autorisation:false,conclusion_finale:'Interprétation interne'};`);
  return { get: id => elements.get(id), run, writes, buttons, context, body,
    finish: (title = 'Résultat exact', text = 'Consigne existante\nà conserver.', type = 'warn') => { context.args = [title, text, type]; run('finishGeneric(...args)'); },
    copy: () => context.window.copyDiagnostic(),
  };
}

test('the built final renderer shows one conclusion and preserves separate instructions', () => {
  const app = harness(); app.finish();
  assert.equal(app.get('finalTitle').textContent, 'Résultat exact');
  assert.doesNotMatch(app.get('finalBox').innerHTML, /Résultat exact/);
  assert.match(app.get('finalBox').innerHTML, /Consigne existante\nà conserver\./);
  assert.doesNotMatch(app.get('diagSummary').innerHTML, /Résultat exact/);
});

test('identical conclusion and instruction text are displayed only once', () => {
  const app = harness(); app.finish('Même texte', 'Même texte');
  assert.equal(app.get('finalTitle').textContent, 'Même texte');
  assert.equal(app.get('finalBox').innerHTML, '');
});

test('the complete recorded path is collapsed by default, not discarded', () => {
  const app = harness(); app.finish();
  const summary = app.get('diagSummary').innerHTML;
  assert.match(summary, /<details\b[^>]*>/);
  assert.doesNotMatch(summary, /<details\b[^>]*\bopen(?:\s|>|=)/);
  assert.match(summary, /Question initiale \?/);
  assert.match(summary, /Essai final \?/);
  assert.match(summary, /Confirmé/);
});

test('collected data is grouped with label/value semantics and preserves zero and false', () => {
  const app = harness(); app.finish();
  const summary = app.get('diagSummary').innerHTML;
  assert.match(summary, /<dl\b/);
  assert.match(summary, /<dt>Câble T2<\/dt><dd>Conforme<\/dd>/);
  assert.match(summary, /<dd>0<\/dd>/);
  assert.match(summary, /<dd>false<\/dd>/);
  assert.doesNotMatch(summary, /Interprétation interne/);
});

test('a validated final step never upgrades an unfinished procedure', () => {
  const app = harness(); app.run("byStep['A-END'].Statut='Validé TechDiag'"); app.finish();
  assert.match(app.get('finalContext')?.innerHTML || '', /Procédure : En construction/);
  assert.equal(app.run('catalogueByProcedure.A.Statut'), 'En construction');
});

test('cross-procedure endings keep the starting and ending procedures distinct', () => {
  const app = harness(); app.run("byStep['A-END'].Procedure_ID='B'"); app.finish();
  const content = app.get('finalContext')?.innerHTML || '';
  assert.match(content, /Borne bleue/);
  assert.match(content, /En construction/);
  assert.match(content, /Procédure de sortie/);
  assert.match(content, /Planification/);
  assert.match(content, /Validé TechDiag/);
});

test('missing status remains unknown rather than validated', () => {
  const app = harness(); app.run('catalogueByProcedure.A.Statut=""'); app.finish();
  assert.match(app.get('finalContext')?.innerHTML || '', /Sans statut/);
});

test('the primary copy action sits before the potentially long summary', () => {
  const app = harness(); app.finish();
  assert.ok(app.get('final').children.indexOf(app.buttons) < app.get('final').children.indexOf(app.get('diagSummary')));
  assert.equal(app.buttons.children.filter(x => x.textContent === '📋 Copier le diagnostic').length, 1);
});

test('copying preserves every recorded answer and collected value when the path is collapsed', async () => {
  const app = harness(); app.finish(); await app.copy();
  assert.equal(app.writes[0], [
    'TECHDIAG – RÉSUMÉ DU DIAGNOSTIC', '',
    'Diagnostic : Borne bleue', 'ID procédure : A', 'Statut procédure : En construction', '',
    'DONNÉES COLLECTÉES', '- Câble T2 : Conforme', '- Mesure : 0', '- Autorisation : false', '',
    'PARCOURS', '1. Question initiale ?', '   → Oui', '2. Essai final ?', '   → Confirmé', '',
    'CONCLUSION', 'Résultat exact',
  ].join('\n'));
});

test('clipboard fallback copies the same complete report', async () => {
  const app = harness({ clipboardFails:true }); app.finish(); await app.copy();
  assert.equal(app.writes.length, 1);
  assert.match(app.writes[0], /Question initiale \?/);
  assert.match(app.writes[0], /Statut procédure : En construction/);
});

test('failed clipboard and fallback do not falsely claim Copié', async () => {
  const app = harness({ clipboardFails:true, fallbackWorks:false }); app.finish(); await app.copy();
  assert.equal(app.writes.length, 0);
  assert.match(app.get('copyStatus').textContent, /impossible/i);
});

test('a new final screen resets old copy feedback and old records', async () => {
  const app = harness(); app.finish(); await app.copy();
  app.run("reportLog=[];collected={};activeProcedureTitle='Autre diagnostic'"); app.finish('Autre résultat', 'Autre consigne');
  assert.equal(app.get('copyStatus').classList.contains('hidden'), true);
  assert.doesNotMatch(app.get('diagSummary').innerHTML, /Question initiale|Conforme/);
  assert.match(app.get('diagSummary').innerHTML, /Aucune étape enregistrée/);
});

test('a late clipboard result cannot mark a newer final screen as copied', async () => {
  const app = harness(); let complete;
  app.context.navigator.clipboard.writeText = () => new Promise(resolve => { complete = resolve; });
  app.finish(); const copying = app.copy();
  app.finish('Autre résultat', 'Autre consigne'); complete(); await copying;
  assert.equal(app.get('copyStatus').classList.contains('hidden'), true);
});

test('late rejection from an older screen cannot overwrite a newer copied report through fallback', async () => {
  const app = harness(); let rejectOldCopy;
  app.context.navigator.clipboard.writeText = () => new Promise((resolve,reject) => { rejectOldCopy=reject; });
  app.finish('Ancien résultat'); const olderCopy = app.copy();
  app.finish('Nouveau résultat');
  app.context.navigator.clipboard.writeText = async value => app.writes.push(value);
  await app.copy();
  rejectOldCopy(Error('Late rejection')); await olderCopy;
  assert.equal(app.writes.length, 1);
  assert.match(app.writes[0], /CONCLUSION\nNouveau résultat$/);
  assert.equal(app.get('copyStatus').textContent, 'Copié ✓');
});

test('conclusion, instructions, data and path escape HTML without changing original state', async () => {
  const app = harness();
  app.run("collected.cable_t2='<b>câble</b>';reportLog[0].answer='<script>unsafe</script>'");
  const before = app.run('JSON.stringify({collected,reportLog,catalogueByProcedure,byStep})');
  app.finish('<img src=x>', '<script>consigne</script>');
  assert.equal(app.get('finalTitle').textContent, '<img src=x>');
  assert.match(app.get('finalBox').innerHTML, /&lt;script&gt;consigne/);
  assert.match(app.get('diagSummary').innerHTML, /&lt;b&gt;câble/);
  assert.match(app.get('diagSummary').innerHTML, /&lt;script&gt;unsafe/);
  assert.equal(app.run('JSON.stringify({collected,reportLog,catalogueByProcedure,byStep})'), before);
});
