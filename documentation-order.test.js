const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'documentation.js'), 'utf8');

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.id = '';
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this);
  }
  insertAdjacentElement(position, child) {
    assert.equal(position, 'afterend');
    child.parentNode = this.parentNode;
    const index = this.parentNode.children.indexOf(this);
    this.parentNode.children.splice(index + 1, 0, child);
  }
}

test('manufacturer documentation is placed after history and before Terminer / Retour / Accueil', async () => {
  const root = new Element('section');
  const meta = new Element('div'); meta.id = 'meta'; root.appendChild(meta);
  const history = new Element('details'); history.id = 'pathHistory'; root.appendChild(history);
  const completion = new Element('div'); completion.id = 'completionControls'; root.appendChild(completion);
  const navigation = new Element('div'); navigation.id = 'navigation'; root.appendChild(navigation);
  const descendants = node => [node, ...node.children.flatMap(descendants)];

  const context = vm.createContext({
    window: {}, URL,
    console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(node => node.id === id) || null,
      createElement: tagName => new Element(tagName),
    },
    querySheet: async name => {
      assert.equal(name, 'Sources_Public');
      return [{
        Source_ID: 'SRC-SCH-TEST',
        Type: 'Constructeur',
        Titre: 'Schneider Charge — notice',
        'Périmètre': 'Schneider Charge EVH5A22N400F',
        URL: 'https://manufacturer.example/schneider.pdf',
        Statut: 'Public',
        Step_IDs: 'SBCL-100',
      }];
    },
    catalogueByProcedure: {
      'SCH-DIAG-BLEU-CLIGNOTANT': {
        Marque: 'Schneider Electric',
        'Modèle / périmètre': 'Schneider Charge EVH5A22N400F',
      },
    },
    currentStepId: 'SBCL-100',
    renderStep() {},
  });

  vm.runInContext(source, context, { filename: 'documentation.js' });
  await context.window.renderManufacturerDocs({
    Procedure_ID: 'SCH-DIAG-BLEU-CLIGNOTANT',
    Step_ID: 'SBCL-100',
    Source: 'SRC-SCH-TEST',
  });

  assert.deepEqual(root.children.map(node => node.id || node.tagName), [
    'meta', 'pathHistory', 'manufacturerDocs', 'completionControls', 'navigation',
  ]);
});
