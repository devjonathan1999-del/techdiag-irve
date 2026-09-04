# Peak Controller Mono / Tri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de Mono / Tri la première décision du module Peak Controller et conserver une branche strictement monophasée ou triphasée jusqu'à la fin.

**Architecture:** Le Google Sheet reste la source canonique des étapes et transitions. Le parcours est séparé au niveau des Step_ID afin d'empêcher les fuites de choix, documents ou visuels entre Mono et Tri. Un petit module UI `peak-context.js` affiche uniquement le rappel de contexte sélectionné ; `settings.js` est étendu pour rendre la référence de réglage sur l'étape mono dédiée.

**Tech Stack:** JavaScript navigateur sans framework, Node 20 `node:test`, Google Sheets via GViz, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-04-peak-mono-tri-flow-design.md`

## Global Constraints

- `SCH-PEAK-PARAM-001` demande Mono / Tri en première question.
- Mono utilise uniquement `EVA2HPC1` ; Tri utilise uniquement `EVA2HPC3`.
- La question de choix du modèle d'appairage devient inaccessible.
- Les règles de puissance et de réglage Peak déjà validées ne changent pas.
- Les documents et visuels mono/tri ne doivent jamais se mélanger après sélection.
- Les autres procédures TechDiag ne changent pas.
- La documentation fabricant reste sous l'historique et avant `Terminer` / `Retour` / `Accueil`.

---

### Task 1: Ajouter le rappel permanent Mono / Tri

**Files:**
- Create: `peak-context.js`
- Create: `peak-context.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: global `collected`, `renderStep`, `step.Procedure_ID`.
- Produces: `#peakContextBadge`, avec texte `Monophasé • EVA2HPC1` ou `Triphasé • EVA2HPC3`.

- [ ] **Step 1: Write the failing test**

Créer `peak-context.test.js` avec un harness DOM minimal et ces cas :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('peak-context.js', 'utf8');

// Harness: #diag + .diagnostic-context + renderStep stub.
// Case 1: collected.type_alimentation_peak_param='Monophasée'
// => textContent === 'Monophasé • EVA2HPC1'.
// Case 2: collected.type_alimentation_peak_param='Triphasée'
// => textContent === 'Triphasé • EVA2HPC3'.
// Case 3: autre Procedure_ID => aucun badge.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test peak-context.test.js`

Expected: FAIL parce que `peak-context.js` n'existe pas encore.

- [ ] **Step 3: Write minimal implementation**

Créer `peak-context.js` :

```js
(() => {
  const text = value => String(value ?? '').trim();

  function peakContextLabel(step) {
    if (text(step?.Procedure_ID) !== 'SCH-PEAK-PARAM-001') return '';
    const supply = text(collected?.type_alimentation_peak_param).toLowerCase();
    if (/monophas/.test(supply)) return 'Monophasé • EVA2HPC1';
    if (/triphas/.test(supply)) return 'Triphasé • EVA2HPC3';
    return '';
  }

  function renderPeakContext(step) {
    document.getElementById('peakContextBadge')?.remove();
    const label = peakContextLabel(step);
    if (!label) return;
    const badge = document.createElement('div');
    badge.id = 'peakContextBadge';
    badge.className = 'badge peak-context-badge';
    badge.textContent = label;
    document.querySelector('#diag .diagnostic-context')?.insertAdjacentElement('afterend', badge);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderPeakContext(step);
  };

  window.renderPeakContext = renderPeakContext;
})();
```

Ajouter dans `index.html` le chargement de `peak-context.js` après le moteur principal et avant les modules qui décorent le rendu.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test peak-context.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

Commit: `feat: afficher le contexte Peak mono tri`

---

### Task 2: Supporter une étape de réglage mono distincte

**Files:**
- Modify: `settings.js`
- Modify: `peak-setting-alert.test.js`
- Modify: `peak-settings-filter.test.js`

**Interfaces:**
- Consumes: `SCHP-130` pour Tri, nouveau `SCHP-M130` pour Mono.
- Produces: même carte de réglage et même alerte dynamique sur les deux étapes, filtrées par `collected.type_alimentation_peak_param` et `puissance_peak_param`.

- [ ] **Step 1: Write the failing tests**

Ajouter un cas mono sur `SCHP-M130` :

```js
const app = createHarness(
  { type_alimentation_peak_param:'Monophasée', puissance_peak_param:'9 kVA' },
  rows,
  'SCHP-M130'
);
await app.render();
assert.match(app.alertText(), /RÉGLAGE PEAK CONTROLLER/);
assert.match(app.cardText(), /EVA2HPC1/);
assert.doesNotMatch(app.cardText(), /EVA2HPC3/);
```

Adapter les harness existants pour accepter le Step_ID en paramètre.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test peak-setting-alert.test.js peak-settings-filter.test.js`

Expected: FAIL car `appendPeakSettingAlert` n'accepte que `SCHP-130`.

- [ ] **Step 3: Implement minimal support**

Dans `settings.js`, remplacer :

```js
if (stepId !== 'SCHP-130' || configId !== 'SCH-CFG-PEAK-001' || !kva || !supply) return;
```

par :

```js
const peakReferenceSteps = new Set(['SCHP-130', 'SCHP-M130']);
if (!peakReferenceSteps.has(stepId) || configId !== 'SCH-CFG-PEAK-001' || !kva || !supply) return;
```

Ne pas dupliquer la logique de filtrage des lignes `Reglages`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test peak-setting-alert.test.js peak-settings-filter.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: séparer la référence Peak mono`

---

### Task 3: Rebrancher la base canonique sur Mono / Tri dès l'entrée

**Files:**
- Modify Google Sheet: `Etapes_Diagnostic`
- Modify Google Sheet: `Transitions_Diagnostic`

**Interfaces:**
- Consumes: `type_alimentation_peak_param`, `puissance_peak_param`.
- Produces: deux branches sans retour au choix de phase.

- [ ] **Step 1: Capture the current rows before write**

Lire `Etapes_Diagnostic!A675:P710` et `Transitions_Diagnostic!A585:L650` et conserver les Step_ID / Transition_ID actuels pour vérification après écriture.

- [ ] **Step 2: Rebuild the entry steps**

Mettre `SCHP-010` en première question :

```text
Instruction / question: L’installation est-elle monophasée ou triphasée ?
Type_réponse: Choix
Valeur / choix attendu: Monophasée / Triphasée
Donnée_collectée: type_alimentation_peak_param
```

Créer :

```text
SCHP-M020 — Que souhaitez-vous faire ?
Choix: ⚙️ Vérifier / régler le Peak Controller / 🔗 Appairer le Peak Controller

SCHP-T020 — Que souhaitez-vous faire ?
Choix: ⚙️ Vérifier / régler le Peak Controller / 🔗 Appairer le Peak Controller
```

Transitions :

```text
SCHP-010 Monophasée -> SCHP-M020
SCHP-010 Triphasée -> SCHP-T020
SCHP-M020 Réglage -> SCHP-110
SCHP-M020 Appairage -> SCHP-210
SCHP-T020 Réglage -> SCHP-120
SCHP-T020 Appairage -> SCHP-220
```

- [ ] **Step 3: Split the settings reference**

Créer `SCHP-M130` comme copie fonctionnelle mono de `SCHP-130`, avec `Unité = SCH-CFG-PEAK-001`.

Modifier les transitions de puissance mono :

```text
9 kVA -> SCHP-M130
12 kVA -> SCHP-M130
```

Garder les transitions tri autorisées vers `SCHP-130`.

Créer pour `SCHP-M130` :

```text
🔗 Appairer le Peak Controller -> SCHP-210
Terminer -> END
```

Modifier `SCHP-130` :

```text
🔗 Appairer le Peak Controller -> SCHP-220
Terminer -> END
```

Ainsi l'appairage ne demande plus le modèle.

- [ ] **Step 4: Split the appairage common steps**

Conserver la branche Tri existante :

```text
SCHP-220 -> SCHP-230 -> SCHP-240 -> SCHP-250
SCHP-250: EVA2HPC3 : System vert + Communication vert fixe / Appairage impossible
SCHP-260: Vérifier / régler -> SCHP-120
SCHP-270 -> SCHP-280
```

Créer la branche Mono :

```text
SCHP-210 -> SCHP-M230 -> SCHP-M240 -> SCHP-M250
SCHP-M250: EVA2HPC1 : Heures pleines + Run verts fixes / Appairage impossible
SCHP-M260: Vérifier / régler -> SCHP-110
SCHP-M270 -> SCHP-M280
```

Les étapes `M230/M240/M270/M280` reprennent les mêmes gestes génériques que leurs équivalents Tri, mais restent des Step_ID distincts.

- [ ] **Step 5: Remove the model-choice route**

Rendre `SCHP-200` inaccessible en supprimant toute transition entrante active.

Modifier dans `IRVE-DIAG-001 / DISJ-400` :

```text
Module non appairé -> SCHP-010
❓ Comment appairer un Peak Controller ? -> SCHP-010
```

- [ ] **Step 6: Verify the sheet graph**

Vérifier par recherche :

```text
aucune transition vers SCHP-200
aucune transition Mono vers SCHP-120/SCHP-220/SCHP-230/SCHP-240/SCHP-250
aucune transition Tri vers SCHP-110/SCHP-210/SCHP-M230/SCHP-M240/SCHP-M250
```

Vérifier aussi que `SCHP-010` est l'étape de plus petit `Ordre` du module.

---

### Task 4: Séparer documentation et visuels par branche

**Files:**
- Modify Google Sheet: `Sources_Public`
- Modify Google Sheet: `Visuels_Terrain`

**Interfaces:**
- Consumes: les nouveaux Step_ID mono et les Step_ID tri existants.
- Produces: documentation et images exclusivement pertinentes pour la branche active.

- [ ] **Step 1: Update manufacturer document assignments**

Pour `SRC-SCH-PEAK-MONO-001`, utiliser uniquement :

```text
SCHP-M020;SCHP-110;SCHP-M130;SCHP-210;SCHP-M230;SCHP-M240;SCHP-M250;SCHP-M260;SCHP-M270;SCHP-M280
```

Pour `SRC-SCH-PEAK-TRI-001`, utiliser uniquement :

```text
SCHP-T020;SCHP-120;SCHP-130;SCHP-220;SCHP-230;SCHP-240;SCHP-250;SCHP-260;SCHP-270;SCHP-280
```

Ne pas assigner de documentation à `SCHP-010`.

- [ ] **Step 2: Keep triphasé visuals on triphasé steps**

Conserver :

```text
VIS-SCH-PEAK-TRI-DIP -> SCHP-130
VIS-SCH-PEAK-PAIR-TRI -> SCHP-220
VIS-SCH-PEAK-PAIR-TRI-2 -> SCHP-230
VIS-SCH-PEAK-PAIR-TRI-3 -> SCHP-240
```

Remplacer les conditions `modele_peak_appairage=EVA2HPC3` par `type_alimentation_peak_param=Triphasée` lorsqu'une condition est conservée.

- [ ] **Step 3: Verify no mono step references triphasé visuals or docs**

Lire `Sources_Public` et `Visuels_Terrain`, puis rechercher `SCHP-M` dans les lignes tri et `SCHP-2xx` tri dans la ligne mono. Expected: aucun mélange.

---

### Task 5: Tester la non-fuite et brancher la CI

**Files:**
- Create: `peak-flow-ui.test.js`
- Modify: `.github/workflows/visual-test.yml`
- Modify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: `peak-context.js`, `settings.js`, ordre global de rendu.
- Produces: garde-fous CI contre retour du mélange Mono/Tri.

- [ ] **Step 1: Write UI regression tests**

Créer `peak-flow-ui.test.js` pour vérifier au minimum :

```js
test('mono context never renders the triphasé context badge', ...);
test('tri context never renders the monophasé context badge', ...);
test('peak context badge is absent before the first Mono/Tri choice', ...);
```

Ajouter dans les tests de réglage le cas `SCHP-M130` mono et garder le cas `SCHP-130` tri.

- [ ] **Step 2: Run all tests locally via the same command as CI**

Run:

```bash
node --test ui.test.js user-view.test.js visual.test.js visual-condition.test.js peak-setting-alert.test.js peak-alert-order.test.js peak-settings-filter.test.js settings.test.js f2m-param-wiring.test.js parameter-layout.test.js contextual-transition.test.js documentation.test.js documentation-shared.test.js documentation-order.test.js peak-context.test.js peak-flow-ui.test.js
```

Expected: 0 failure.

- [ ] **Step 3: Add the new tests to both workflows**

Ajouter `peak-context.test.js peak-flow-ui.test.js` à la commande `node --test` dans :

```text
.github/workflows/visual-test.yml
.github/workflows/pages.yml
```

- [ ] **Step 4: Build and test built summary**

Exécuter les mêmes étapes de build que la CI actuelle et vérifier le résumé construit.

- [ ] **Step 5: Commit**

Commit: `test: verrouiller les parcours Peak mono tri`

---

### Task 6: Revue finale et PR

**Files:**
- Review all changed GitHub files
- Review Google Sheet ranges touched above

**Interfaces:**
- Produces: PR fusionnable sans changement hors périmètre.

- [ ] **Step 1: Verify the final user journeys**

Parcours à rejouer :

```text
Standalone -> Mono -> Réglage -> 9 kVA -> EVA2HPC1 -> Appairage -> réussite -> Réglage -> 9 kVA
Standalone -> Tri -> Réglage -> 18 kVA -> EVA2HPC3 -> Appairage -> réussite -> Réglage -> 18 kVA
IRVE-DIAG-001 -> Comment appairer -> Mono -> appairage mono -> Retour diagnostic
IRVE-DIAG-001 -> Comment appairer -> Tri -> appairage tri -> Retour diagnostic
```

Expected: aucune question de modèle et aucune documentation/visuel de la branche opposée.

- [ ] **Step 2: Run final CI-equivalent test command**

Expected: PASS complet.

- [ ] **Step 3: Open PR**

Titre : `Séparer les parcours Peak Controller mono et tri`

Body : décrire la première sélection Mono/Tri, la suppression du choix de modèle, les branches appairage séparées, le badge de contexte, la séparation documentaire et les tests.
