const test = require('node:test');
const assert = require('node:assert/strict');
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
