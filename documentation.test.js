const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'documentation.js'), 'utf8');

// Minimal DOM boundary: the real documentation renderer creates and removes
// these elements. No selection or rendering logic is replaced by a test double.
function createHarness(rows) {
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.style = {};
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
    }
    remove() {
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      }
    }
    insertAdjacentElement(position, child) {
      assert.equal(position, 'afterend');
      child.parentNode = this.parentNode;
      this.parentNode.children.splice(this.parentNode.children.indexOf(this) + 1, 0, child);
    }
  }
  const root = new Element('section');
  const meta = new Element('div');
  meta.id = 'meta';
  root.appendChild(meta);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const renderedSteps = [];
  const context = vm.createContext({
    window: {}, URL,
    console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(node => node.id === id) || null,
      createElement: tagName => new Element(tagName),
    },
    querySheet: async name => {
      assert.equal(name, 'Sources_Public');
      return typeof rows === 'function' ? rows() : rows;
    },
    catalogueByProcedure: {
      'SCH-DIAG-BLEU-CLIGNOTANT': { Marque: 'Schneider Electric', 'Modèle / périmètre': 'Schneider Charge EVH5A22N400F' },
      'SCH-DIAG-PLANIFICATION': { Marque: 'Schneider Electric', 'Modèle / périmètre': 'Schneider Charge EVH5A22N400F' },
      'F2M-DIAG-107': { Marque: 'Free2move eSolutions', 'Modèle / périmètre': 'eProWallbox Move' },
    },
    currentStepId: '',
    renderStep: step => renderedSteps.push(step),
  });
  vm.runInContext(source, context, { filename: 'documentation.js' });
  return {
    context,
    renderedSteps,
    async render(step) {
      context.currentStepId = step.Step_ID;
      await context.window.renderManufacturerDocs(step);
    },
    cards: () => descendants(root).filter(node => node.id === 'manufacturerDocs'),
    links: () => descendants(root).filter(node => node.tagName === 'a'),
  };
}

const doc = (id, stepIds, overrides = {}) => ({
  Source_ID: id, Type: 'Constructeur', Titre: `Schneider Charge — ${id}`,
  'Périmètre': 'Schneider Charge EVH5A22N400F',
  URL: `https://manufacturer.example/${id}`, 'Informations utilisées': 'Aide ciblée',
  Statut: 'Public', Step_IDs: stepIds, ...overrides,
});
const step = (id, overrides = {}) => ({
  Procedure_ID: id.startsWith('SPLAN-') ? 'SCH-DIAG-PLANIFICATION' : 'SCH-DIAG-BLEU-CLIGNOTANT',
  Step_ID: id, Source: 'Expertise TechDiag validée', ...overrides,
});
const relevantDocs = [
  doc('PLAN', 'SPLAN-030; SPLAN-120'),
  doc('MODES', 'SPLAN-020; SPLAN-150'),
  doc('AI', 'SPLAN-070; SPLAN-110'),
  doc('TARIF', 'SPLAN-060; SPLAN-070'),
  doc('TIC', 'SBCL-100; SBCL-125'),
  doc('PAIR', 'SBCL-230; SBCL-240'),
  doc('LED', 'SPLAN-600'),
];

test('initial planning and unfinished Smartcharge steps have no documentation block', async () => {
  const app = createHarness(relevantDocs);
  for (const id of ['SBCL-010', 'SPLAN-010', 'SPLAN-400']) {
    await app.render(step(id));
    assert.equal(app.cards().length, 0, id);
    assert.deepEqual(app.links(), []);
  }
});

for (const [id, expected] of [
  ['SPLAN-030', ['PLAN']], ['SPLAN-020', ['MODES']],
  ['SPLAN-060', ['TARIF']], ['SPLAN-070', ['AI', 'TARIF']],
  ['SPLAN-110', ['AI']], ['SBCL-100', ['TIC']],
  ['SBCL-125', ['TIC']], ['SBCL-240', ['PAIR']], ['SPLAN-600', ['LED']],
]) {
  test(`${id} only displays its associated documents`, async () => {
    const app = createHarness(relevantDocs);
    const currentStep = step(id);
    const snapshot = JSON.stringify(currentStep);
    await app.render(currentStep);
    assert.deepEqual(app.links().map(link => link.href), expected.map(name => `https://manufacturer.example/${name}`));
    assert.equal(JSON.stringify(currentStep), snapshot, 'The diagnostic step must remain unchanged');
  });
}

test('step IDs are exact tokens, not substrings or procedure-wide matches', async () => {
  const app = createHarness([
    doc('EXACT', ' SBCL-100, SBCL-125 | SBCL-140\nSBCL-120 '),
    doc('PREFIX', 'SBCL-1000'), doc('OTHER', 'SBCL-010'), doc('UNASSIGNED', ''),
  ]);
  await app.render(step('SBCL-100'));
  assert.deepEqual(app.links().map(link => link.href), ['https://manufacturer.example/EXACT']);
});

test('unassigned documents require an exact URL or Source_ID citation on the current step', async () => {
  const app = createHarness([
    doc('SRC-ONE', ''), doc('SRC-TWO', ''), doc('SRC-THREE', ''),
    doc('SRC-ONE-EXTRA', ''),
  ]);
  await app.render(step('SBCL-100', {
    Source: 'Constructeur (SRC-ONE) | https://manufacturer.example/SRC-TWO#page=5',
  }));
  assert.deepEqual(app.links().map(link => link.href), [
    'https://manufacturer.example/SRC-ONE', 'https://manufacturer.example/SRC-TWO',
  ]);
});

test('explicit assignment wins over a broad citation on a different step', async () => {
  const app = createHarness([doc('TIC', 'SBCL-100')]);
  await app.render(step('SBCL-010', { Source: 'https://manufacturer.example/TIC' }));
  assert.equal(app.cards().length, 0);
});

test('private, non-manufacturer, wrong-model and unsafe links are not shown', async () => {
  const app = createHarness([
    doc('GOOD', 'SBCL-100'),
    doc('PRIVATE', 'SBCL-100', { Statut: 'Interne' }),
    doc('FORUM', 'SBCL-100', { Type: 'Forum' }),
    doc('OTHER', 'SBCL-100', { Titre: 'Autre fabricant', 'Périmètre': 'Autre borne' }),
    doc('JS', 'SBCL-100', { URL: 'javascript:alert(1)' }),
    doc('EMPTY', 'SBCL-100', { URL: '' }),
  ]);
  await app.render(step('SBCL-100'));
  assert.deepEqual(app.links().map(link => link.href), ['https://manufacturer.example/GOOD']);
});

test('duplicate source rows do not create duplicate document buttons', async () => {
  const app = createHarness([doc('TIC', 'SBCL-100'), doc('TIC-ALIAS', 'SBCL-100', { URL: 'https://manufacturer.example/TIC' })]);
  await app.render(step('SBCL-100'));
  assert.equal(app.links().length, 1);
});

test('a single document keeps its descriptive label and opens safely in a new tab', async () => {
  const app = createHarness([doc('TIC', 'SBCL-100', { Titre: 'Détection TIC dans eSetup' })]);
  await app.render(step('SBCL-100'));
  const [link] = app.links();
  assert.equal(link.textContent, '📘 Détection TIC dans eSetup');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
});

test('navigation removes previous documents, including when returning to initial planning', async () => {
  const app = createHarness(relevantDocs);
  await app.render(step('SBCL-100'));
  await app.render(step('SBCL-240'));
  assert.equal(app.cards().length, 1);
  assert.deepEqual(app.links().map(link => link.href), ['https://manufacturer.example/PAIR']);
  await app.render(step('SBCL-010'));
  assert.equal(app.cards().length, 0);
});

test('late loading cannot insert duplicate blocks after navigating away and back', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const app = createHarness(() => pending);
  const first = app.render(step('SBCL-100'));
  const second = app.render(step('SBCL-240'));
  const third = app.render(step('SBCL-100'));
  release(relevantDocs);
  await Promise.all([first, second, third]);
  assert.equal(app.cards().length, 1);
  assert.deepEqual(app.links().map(link => link.href), ['https://manufacturer.example/TIC']);
});

test('failed documentation loading leaves the diagnostic renderer available', async () => {
  const app = createHarness(() => Promise.reject(new Error('offline')));
  const currentStep = step('SBCL-100');
  app.context.currentStepId = currentStep.Step_ID;
  app.context.renderStep(currentStep);
  await app.context.window.renderManufacturerDocs(currentStep);
  assert.deepEqual(app.renderedSteps, [currentStep]);
  assert.equal(app.cards().length, 0);
});

test('a cited Free2move document can still be shown without Schneider-specific code', async () => {
  const app = createHarness([doc('F2M', '', { Titre: 'Free2move Move — installation', 'Périmètre': 'eProWallbox Move' })]);
  await app.render(step('F107-020', {
    Procedure_ID: 'F2M-DIAG-107', Source: 'Manuel https://manufacturer.example/F2M',
  }));
  assert.deepEqual(app.links().map(link => link.href), ['https://manufacturer.example/F2M']);
});
