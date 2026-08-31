const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'documentation.js'), 'utf8');

function harness(rows) {
  class Element {
    constructor(tagName) { this.tagName = tagName; this.children = []; this.style = {}; }
    appendChild(child) { child.parentNode = this; this.children.push(child); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
    insertAdjacentElement(position, child) {
      assert.equal(position, 'afterend');
      child.parentNode = this.parentNode;
      this.parentNode.children.splice(this.parentNode.children.indexOf(this) + 1, 0, child);
    }
  }
  const root = new Element('section');
  const meta = new Element('div'); meta.id = 'meta'; root.appendChild(meta);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const context = vm.createContext({
    window: {}, URL, console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(node => node.id === id) || null,
      createElement: tagName => new Element(tagName),
    },
    querySheet: async name => { assert.equal(name, 'Sources_Public'); return rows; },
    catalogueByProcedure: {
      'IRVE-DIAG-001': { Marque:'Générique IRVE', 'Modèle / périmètre':'Installation résidentielle / Linky / AGCP' },
    },
    currentStepId: 'DISJ-314',
    renderStep() {},
  });
  vm.runInContext(source, context, { filename:'documentation.js' });
  return { context, links: () => descendants(root).filter(node => node.tagName === 'a') };
}

test('exact Step_ID assignment shows manufacturer documentation on a generic shared branch', async () => {
  const app = harness([{
    Source_ID:'SRC-VEST', Type:'Constructeur', Titre:'Vestel EVC04 – Guide installation',
    'Périmètre':'EVC04 / gestion dynamique', URL:'https://vestel.example/guide.pdf',
    Statut:'Public', Step_IDs:'DISJ-314; DISJ-315',
  }]);
  await app.context.window.renderManufacturerDocs({ Procedure_ID:'IRVE-DIAG-001', Step_ID:'DISJ-314', Source:'Expertise TechDiag' });
  assert.deepEqual(app.links().map(link => link.href), ['https://vestel.example/guide.pdf']);
});
