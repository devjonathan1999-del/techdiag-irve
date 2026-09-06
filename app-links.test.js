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
      if (position === 'beforebegin') siblings.splice(index, 0, child);
      else if (position === 'afterend') siblings.splice(index + 1, 0, child);
      else throw new Error(`Unsupported position: ${position}`);
    }
  }

  const root = new Element('section');
  const meta = new Element('div');
  meta.id = 'meta';
  const controls = new Element('div');
  controls.id = 'controls';
  root.appendChild(meta);
  root.appendChild(controls);

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
      'WIFI-TEST-ANDROID-001': {
        Marque: 'Toutes marques',
        'Modèle / périmètre': 'Android / Wi-Fi 2,4 GHz',
      },
    },
    currentStepId: '',
    renderStep() {},
  });

  vm.runInContext(source, context, { filename: 'documentation.js' });
  return { root, context, descendants, controls };
}

test('WAND-010 displays the Google Play app button before Continue', async () => {
  const playUrl = 'https://play.google.com/store/search?q=wifi+monitor&c=apps&utm_source=emea_Med';
  const app = createHarness([{
    Source_ID: 'APP-WIFI-MONITOR-ANDROID',
    Type: 'Application',
    Titre: 'Ouvrir Wi-Fi Monitor sur Google Play',
    'Périmètre': 'Android / Wi-Fi Monitor',
    URL: playUrl,
    'Informations utilisées': 'Téléchargement de l’application utilisée par le MODOP Android.',
    Statut: 'Public',
    Step_IDs: 'WAND-010',
  }]);

  const step = {
    Procedure_ID: 'WIFI-TEST-ANDROID-001',
    Step_ID: 'WAND-010',
    Source: 'Expertise TechDiag',
  };
  app.context.currentStepId = step.Step_ID;
  app.context.renderStep(step);
  await Promise.resolve();
  await Promise.resolve();

  const links = app.descendants(app.root).filter(node => node.tagName === 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, playUrl);
  assert.equal(links[0].textContent, '📱 Ouvrir Wi-Fi Monitor sur Google Play');
  assert.equal(links[0].target, '_blank');
  assert.equal(links[0].rel, 'noopener noreferrer');

  const appBlock = app.descendants(app.root).find(node => node.id === 'stepAppLinks');
  assert.ok(appBlock, 'the app link block must be rendered');
  assert.ok(
    app.root.children.indexOf(appBlock) < app.root.children.indexOf(app.controls),
    'the app button must appear before the Continue controls',
  );
});
