const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'visuals.js'), 'utf8');

function createHarness(selectedSupply, condition = 'type_alimentation_peak_param=Triphasée') {
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.style = {};
      this.id = '';
      this._textContent = '';
    }
    get textContent() {
      return this.children.length ? this.children.map(child => child.textContent).join('') : this._textContent;
    }
    set textContent(value) {
      this._textContent = String(value ?? '');
      this.children = [];
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }
    insertAdjacentElement(position, child) {
      assert.equal(position, 'afterend');
      child.parentNode = this.parentNode;
      const index = this.parentNode.children.indexOf(this);
      this.parentNode.children.splice(index + 1, 0, child);
    }
  }

  const root = new Element('section');
  const hint = new Element('div');
  hint.id = 'hint';
  root.appendChild(hint);
  const descendants = node => [node, ...node.children.flatMap(descendants)];

  const rows = [{
    Visuel_ID: 'VIS-SCH-PEAK-TRI-DIP',
    Marque: 'Schneider Electric',
    Sujet: 'Réglage DIP Peak Controller triphasé',
    Procedure_ID: 'SCH-PEAK-PARAM-001',
    Step_ID: 'SCHP-130',
    URL: 'https://raw.githubusercontent.com/devjonathan1999-del/techdiag-irve/main/Capture/R%C3%A9glage%20DIP%20peak%20en%20tri.png',
    'Légende': 'Voir le réglage DIP Peak en tri',
    Affichage: 'Image',
    Condition_affichage: condition,
  }];

  const context = vm.createContext({
    window: {},
    console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(node => node.id === id) || null,
      createElement: tag => new Element(tag),
    },
    querySheet: async name => {
      assert.equal(name, 'Visuels_Terrain');
      return rows;
    },
    currentStepId: 'SCHP-130',
    collected: { type_alimentation_peak_param: selectedSupply },
    renderStep() {},
  });

  vm.runInContext(source, context, { filename: 'visuals.js' });

  return {
    async render() {
      await context.window.renderStepVisual({ Procedure_ID: 'SCH-PEAK-PARAM-001', Step_ID: 'SCHP-130' });
    },
    cards() {
      return descendants(root).filter(node => node.id === 'stepVisual');
    },
  };
}

test('Peak Controller DIP image is displayed on SCHP-130 only after selecting Triphasée', async () => {
  const tri = createHarness('Triphasée');
  await tri.render();
  assert.equal(tri.cards().length, 1);

  const mono = createHarness('Monophasée');
  await mono.render();
  assert.equal(mono.cards().length, 0);
});

test('visuals without Condition_affichage remain visible', async () => {
  const app = createHarness('Monophasée', '');
  await app.render();
  assert.equal(app.cards().length, 1);
});
