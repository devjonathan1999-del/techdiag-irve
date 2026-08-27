const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { indexVisuals, getStepVisuals, renderStepVisualsHtml } = require('./visuals');

test('indexes only usable visuals by procedure and step', () => {
  const rows = [
    { Procedure_ID:'F2M-DIAG-107', Step_ID:'F107-020', URL:'assets/f2m/107/cn12.svg', Légende:'Câblage CN12', Statut:'Validé TechDiag' },
    { Procedure_ID:'F2M-DIAG-107', Step_ID:'', URL:'assets/ignored.svg', Légende:'Sans étape' },
    { Procedure_ID:'F2M-DIAG-107', Step_ID:'F107-020', URL:'', Légende:'Sans URL' }
  ];
  const index = indexVisuals(rows);
  assert.equal(index['F2M-DIAG-107::F107-020'].length, 1);
});

test('returns visuals only for the active procedure and step', () => {
  const index = indexVisuals([
    { Procedure_ID:'F2M-DIAG-107', Step_ID:'F107-020', URL:'assets/a.svg', Légende:'A' },
    { Procedure_ID:'OTHER', Step_ID:'F107-020', URL:'assets/b.svg', Légende:'B' }
  ]);
  assert.deepEqual(getStepVisuals(index, 'F2M-DIAG-107', 'F107-020').map(v => v.URL), ['assets/a.svg']);
});

test('renders an escaped visual card with an enlarge link', () => {
  const html = renderStepVisualsHtml([
    { URL:'assets/f2m/107/cn12.svg', Légende:'CN12 < DPM', Sujet:'Câblage DPM' }
  ]);
  assert.match(html, /CN12 &lt; DPM/);
  assert.match(html, /target="_blank"/);
  assert.match(html, />Agrandir</);
  assert.match(html, /src="assets\/f2m\/107\/cn12\.svg"/);
});

test('raw index supports step visuals even when Cloudflare serves the repository without running build.js', () => {
  const source = fs.readFileSync('index.html', 'utf8');
  assert.match(source, /<script src="visuals\.js"><\/script>/);
  assert.match(source, /id="stepVisuals"/);
  assert.match(source, /Visuels_Terrain/);
  assert.match(source, /visual-open/);
});

test('build keeps a single visual runtime when source already contains it', () => {
  execFileSync(process.execPath, ['build.js'], { stdio:'pipe' });
  const built = fs.readFileSync('dist/index.html', 'utf8');
  assert.equal((built.match(/id="stepVisuals"/g) || []).length, 1);
  assert.equal((built.match(/id="techdiag-visuals-script"/g) || []).length, 1);
});
