const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'documentation.js'), 'utf8');

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
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }
    insertAdjacentElement(position, child) {
      const siblings = this.parentNode.children;
      const index = siblings.indexOf(this);
      child.parentNode = this.parentNode;
      if (position === 'afterend') siblings.splice(index + 1, 0, child);
      else if (position === 'beforebegin') siblings.splice(index, 0, child);
      else throw new Error(`Unsupported position: ${position}`);
    }
  }

  const root = new Element('section');
  const meta = new Element('div');
  meta.id = 'meta';
  root.appendChild(meta);

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
      return rows;
    },
    catalogueByProcedure: {
      'SCH-DIAG-TEST': {
        Marque: 'Schneider Electric',
        'Modèle / périmètre': 'Schneider Charge',
      },
    },
    currentStepId: '',
    renderStep() {},
  });

  vm.runInContext(source, context, { filename: 'documentation.js' });
  return { root, context, descendants };
}

test('les liens SharePoint ne sont jamais affichés dans les procédures', async () => {
  const publicUrl = 'https://www.se.com/fr/fr/download/document/PKR9462701_FR/';
  const sharepointUrl = 'https://example.sharepoint.com/sites/techdiag/Shared%20Documents/procedure.pdf';
  const app = createHarness([
    {
      Source_ID: 'SRC-PUBLIC',
      Type: 'Constructeur',
      Titre: 'Documentation publique',
      'Périmètre': 'Schneider Charge',
      URL: publicUrl,
      Statut: 'Public',
      Step_IDs: 'STEP-010',
    },
    {
      Source_ID: 'SRC-SHAREPOINT',
      Type: 'Constructeur',
      Titre: 'Document SharePoint',
      'Périmètre': 'Schneider Charge',
      URL: sharepointUrl,
      Statut: 'Public',
      Step_IDs: 'STEP-010',
    },
  ]);

  const step = {
    Procedure_ID: 'SCH-DIAG-TEST',
    Step_ID: 'STEP-010',
    Source: 'SRC-PUBLIC | SRC-SHAREPOINT',
  };

  app.context.currentStepId = step.Step_ID;
  app.context.renderStep(step);
  await new Promise(resolve => setImmediate(resolve));

  const links = app.descendants(app.root).filter(node => node.tagName === 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, publicUrl);
  assert.equal(links.some(link => String(link.href || '').includes('sharepoint.com')), false);
});
