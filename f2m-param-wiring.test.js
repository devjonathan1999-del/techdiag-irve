const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, 'settings.js'), 'utf8');

function createHarness() {
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.style = {};
      this._textContent = '';
      this.id = '';
      this.className = '';
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
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this);
    }
    insertAdjacentElement(position, child) {
      assert.equal(position, 'afterend');
      child.parentNode = this.parentNode;
      const index = this.parentNode.children.indexOf(this);
      this.parentNode.children.splice(index + 1, 0, child);
    }
  }

  const root = new Element('section');
  const meta = new Element('div');
  meta.id = 'meta';
  root.appendChild(meta);
  const descendants = node => [node, ...node.children.flatMap(descendants)];

  const rows = [
    { Config_ID:'F2M-CFG-107', Configuration:'DPM – Modbus RS485', Alimentation:'Mono et Tri', Élément:'Adresse', 'Valeur attendue':'001', Condition:'eProWallbox Move / Full' },
    { Config_ID:'F2M-CFG-107', Configuration:'DPM – Modbus RS485', Alimentation:'Mono et Tri', Élément:'Parité', 'Valeur attendue':'EVEN', Condition:'eProWallbox Move / Full' },
    { Config_ID:'F2M-CFG-107', Configuration:'DPM – Modbus RS485', Alimentation:'Mono et Tri', Élément:'Débit baud', 'Valeur attendue':'38.4', Condition:'eProWallbox Move / Full' },
  ];

  const context = vm.createContext({
    window: {},
    console: { warn() {} },
    document: {
      getElementById: id => descendants(root).find(node => node.id === id) || null,
      createElement: tag => new Element(tag),
    },
    querySheet: async name => {
      assert.equal(name, 'Reglages');
      return rows;
    },
    currentStepId: '',
    collected: {},
    renderStep() {},
  });

  vm.runInContext(source, context, { filename: 'settings.js' });
  return {
    context,
    root,
    descendants: () => descendants(root),
    async render(step) {
      context.currentStepId = step.Step_ID;
      await context.window.renderSettingsReference(step);
    },
  };
}

test('F2M parameter module shows the CN12 wiring reference inline before Gavazzi captures without termination guidance', async () => {
  const app = createHarness();
  await app.render({ Step_ID:'F2MP-010', Unité:'F2M-CFG-107' });

  const card = app.descendants().find(node => node.id === 'settingsReference');
  assert.ok(card);
  assert.match(card.textContent, /Câblage DPM \/ Modbus RS485/);
  assert.match(card.textContent, /GND.*GND/);
  assert.match(card.textContent, /continuité/);
  assert.doesNotMatch(card.textContent, /terminaison|120\s*Ω|résistance/i);

  const images = app.descendants().filter(node => node.tagName === 'img');
  assert.equal(images.length, 1);
  assert.equal(images[0].src, 'assets/f2m/107/cablage-cn12.png');
  assert.match(images[0].alt, /câblage DPM \/ CN12/i);

  const links = card.children.filter(node => node.tagName === 'a');
  assert.deepEqual(links.map(link => link.textContent), [
    '🖼️ Configuration Gavazzi monophasé',
    '🖼️ Configuration Gavazzi triphasé',
  ]);
});

test('error 107 keeps its existing settings links without duplicating the CN12 reference', async () => {
  const app = createHarness();
  await app.render({ Step_ID:'F107-010', Unité:'F2M-CFG-107' });
  const card = app.descendants().find(node => node.id === 'settingsReference');
  const links = card.children.filter(node => node.tagName === 'a');
  assert.deepEqual(links.map(link => link.textContent), [
    '🖼️ Configuration Gavazzi monophasé',
    '🖼️ Configuration Gavazzi triphasé',
  ]);
});
