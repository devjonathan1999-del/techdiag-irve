# TechDiag Lisibilité Globale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Améliorer la lisibilité de toutes les étapes TechDiag sans modifier la logique métier, en gardant une consigne principale courte, une explication secondaire et des valeurs de réglage mieux hiérarchisées.

**Architecture:** La refonte reste dans l’architecture actuelle : `index.html` continue de rendre toutes les étapes du moteur, `settings.js` continue de rendre les références de réglage, et Google Sheets reste la source de vérité des textes métier. Le frontend ajoute uniquement une typographie adaptative selon la longueur réelle de la consigne et une hiérarchie visuelle des valeurs ; la séparation sémantique question/explication reste pilotée par les colonnes existantes de la base, sans découpage automatique des phrases.

**Tech Stack:** HTML/CSS/JavaScript vanilla, Node.js 20 `node:test`, Google Sheets, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-01-techdiag-lisibilite-globale-design.md`

## Global Constraints

- Conserver l’interface actuelle de TechDiag ; ne pas transformer les diagnostics en fiches multi-cartes ou checklists.
- Ne modifier aucune transition, conclusion, règle métier ou valeur collectée.
- `Instruction / question` reste la consigne principale ; `Condition / interprétation` reste le second niveau de lecture.
- Le frontend ne doit jamais découper automatiquement une instruction selon la ponctuation.
- Les questions longues ne doivent jamais être tronquées ni masquées.
- Les valeurs de `Reglages` restent issues de Google Sheets et doivent être rendues sans interprétation supplémentaire.
- La première passe nettoie uniquement `F2M-PARAM-001` comme cas de référence ; les autres textes seront revus progressivement pendant leurs replays.
- Le rendu mobile doit rester sans débordement horizontal.

---

### Task 1: Typographie adaptative de la consigne principale

**Files:**
- Modify: `index.html` — styles `.question` et fonction `renderStep(step)`
- Test: `ui.test.js`

**Interfaces:**
- Consumes: `step["Instruction / question"]` déjà fourni par Google Sheets.
- Produces: fonction globale `questionReadabilityClass(text)` retournant `question`, `question compact` ou `question dense`; `renderStep(step)` applique cette classe avant de renseigner le texte.

- [ ] **Step 1: Ajouter les tests RED pour les trois tailles de consigne**

Ajouter dans `ui.test.js` :

```js
test('question typography adapts to text length without changing the text', () => {
  const app = harness();

  app.run("byStep['A-010']['Instruction / question']='Question courte ?'; startProcedure('A')");
  assert.equal(app.get('question').className, 'question');
  assert.equal(app.get('question').textContent, 'Question courte ?');

  app.run("byStep['A-010']['Instruction / question']='x'.repeat(120); startProcedure('A')");
  assert.equal(app.get('question').className, 'question compact');
  assert.equal(app.get('question').textContent.length, 120);

  app.run("byStep['A-010']['Instruction / question']='x'.repeat(220); startProcedure('A')");
  assert.equal(app.get('question').className, 'question dense');
  assert.equal(app.get('question').textContent.length, 220);
});
```

Et compléter le test existant `questions, safety guidance and provenance survive presentation changes verbatim` avec :

```js
assert.equal(app.get('question').className, 'question');
assert.equal(app.get('hint').textContent, 'Consigne de sécurité à garder visible.');
```

- [ ] **Step 2: Exécuter le test ciblé et vérifier qu’il échoue**

Run:

```bash
node --test ui.test.js
```

Expected: FAIL sur `question typography adapts to text length...` parce que `renderStep` ne pose pas encore les classes `compact` / `dense`.

- [ ] **Step 3: Implémenter le classement de longueur minimal dans `index.html`**

Ajouter près des helpers de rendu :

```js
function questionReadabilityClass(text){
  const length=str(text).trim().length;
  if(length>180)return 'question dense';
  if(length>110)return 'question compact';
  return 'question';
}
```

Dans `renderStep(step)`, remplacer l’affectation directe actuelle :

```js
document.getElementById("question").textContent=step["Instruction / question"]||"";
```

par :

```js
const question=document.getElementById("question");
const questionText=step["Instruction / question"]||"";
question.className=questionReadabilityClass(questionText);
question.textContent=questionText;
```

Ne toucher ni à `hintParts`, ni à `renderControls(step)`, ni au routage.

- [ ] **Step 4: Ajouter les styles desktop et mobile correspondants**

Dans le bloc CSS de `index.html`, conserver `.question` comme base et ajouter :

```css
.question.compact{font-size:24px;line-height:1.38;max-width:780px}
.question.dense{font-size:21px;line-height:1.44;max-width:780px}
```

Dans `@media(max-width:760px)` ajouter :

```css
.question.compact{font-size:20px;line-height:1.42}
.question.dense{font-size:18px;line-height:1.48}
```

Ne pas ajouter de `max-height`, `overflow:hidden`, `line-clamp` ou ellipsis.

- [ ] **Step 5: Exécuter les tests UI**

Run:

```bash
node --test ui.test.js
```

Expected: PASS, y compris le test de conservation verbatim de la question et du hint.

- [ ] **Step 6: Commit**

```bash
git add index.html ui.test.js
git commit -m "ui: adapter la lisibilite des consignes longues"
```

---

### Task 2: Hiérarchiser visuellement les valeurs dans le bloc Réglages

**Files:**
- Modify: `settings.js`
- Modify: `index.html` — styles du bloc `settingsReference`
- Test: `settings.test.js`

**Interfaces:**
- Consumes: lignes `Reglages` avec `Élément`, `Valeur attendue`, `Condition`.
- Produces: chaque `.setting-row` contient `.setting-name`, `.setting-value` et éventuellement `.setting-condition`, sans changer le texte métier ni l’ordre des lignes.

- [ ] **Step 1: Ajouter un test RED sur la séparation nom / valeur**

Dans `settings.test.js`, sur un rendu `F2M-CFG-107`, ajouter un test dédié :

```js
test('settings rows visually separate the label from the expected value', async () => {
  const app = createHarness(baseRows);
  await app.render({ Step_ID:'F107-010', Unité:'F2M-CFG-107' });

  const rows = app.cards()[0].children.filter(x => x.className === 'setting-row');
  assert.ok(rows.length >= 3);
  assert.equal(rows[0].children[0].className, 'setting-name');
  assert.equal(rows[0].children[1].className, 'setting-value');
  assert.equal(rows[0].children[1].textContent, '001');
});
```

Le harness doit continuer à utiliser `textContent` / `appendChild` uniquement ; ne pas introduire de `innerHTML` pour les valeurs de Sheet.

- [ ] **Step 2: Lancer le test et vérifier le RED**

Run:

```bash
node --test settings.test.js
```

Expected: FAIL parce que `.setting-row` contient actuellement un seul `textContent` plat.

- [ ] **Step 3: Remplacer le rendu plat par des spans sûrs**

Dans `settings.js`, remplacer `settingLabel(row, duplicates)` par un helper structuré :

```js
function settingParts(row, duplicates) {
  const element = settingText(row?.['Élément']);
  const expected = settingText(row?.['Valeur attendue']);
  const condition = settingText(row?.Condition);
  const conditionInLabel = condition && (duplicates > 1 || normalizedKva(condition));
  return {
    label: conditionInLabel ? `${element} — ${condition}` : element,
    value: expected,
    suffix: condition && !conditionInLabel ? ` — ${condition}` : '',
  };
}
```

Puis, dans la boucle `rows.forEach`, construire le contenu sans `innerHTML` :

```js
const parts = settingParts(row, counts.get(key) || 1);

const name = document.createElement('span');
name.className = 'setting-name';
name.textContent = `${parts.label} : `;
item.appendChild(name);

const value = document.createElement('span');
value.className = 'setting-value';
value.textContent = parts.value;
item.appendChild(value);

if (parts.suffix) {
  const condition = document.createElement('span');
  condition.className = 'setting-condition';
  condition.textContent = parts.suffix;
  item.appendChild(condition);
}
```

Le texte visible doit rester équivalent à l’ancien rendu, notamment pour les conditions kVA de Vestel.

- [ ] **Step 4: Ajouter une hiérarchie visuelle légère dans `index.html`**

Ajouter :

```css
.setting-name{color:#cbd8ee}
.setting-value{color:#f5fbff;font-weight:800;letter-spacing:.01em}
.setting-condition{color:var(--muted)}
```

Ne pas créer de nouvelles cartes, couleurs de statut ou badges pour les valeurs.

- [ ] **Step 5: Vérifier tous les tests des réglages**

Run:

```bash
node --test settings.test.js
```

Expected: PASS, y compris les tests Vestel et les liens Gavazzi mono/tri.

- [ ] **Step 6: Commit**

```bash
git add settings.js settings.test.js index.html
git commit -m "ui: hierarchiser les valeurs de reglage"
```

---

### Task 3: Nettoyer le cas de référence F2M dans Google Sheets

**Files / data:**
- Modify: Google Sheet `TechDiag - Base Vestel`
- Sheet: `Etapes_Diagnostic`
- Target row identified by `Procedure_ID=F2M-PARAM-001` and `Step_ID=F2MP-010`
- Verify: `Catalogue_Procedures`, `Reglages`, `Visuels_Terrain`, `Sources_Public` remain unchanged except for the already-existing links to `F2MP-010`.

**Interfaces:**
- Consumes: rendu actuel de `renderStep` où `Instruction / question` devient `#question` et `Condition / interprétation` devient `#hint`.
- Produces: `F2MP-010` avec un titre court et une explication secondaire ; aucune transition ni valeur collectée ne change.

- [ ] **Step 1: Lire la ligne exacte avant écriture**

Lire la ligne contenant `F2MP-010` dans `Etapes_Diagnostic` et confirmer les colonnes :

```text
E = Instruction / question
H = Condition / interprétation
```

Vérifier avant mutation que :

```text
Procedure_ID = F2M-PARAM-001
Step_ID = F2MP-010
Type_réponse = Choix
Valeur / choix attendu = Terminer
Unité = F2M-CFG-107
```

- [ ] **Step 2: Modifier uniquement la consigne et l’explication**

Écrire exactement :

```text
Instruction / question:
Réglage DPM / Modbus Free2move
```

et :

```text
Condition / interprétation:
Dans PowerUp > Power Management > Dynamic Power Management, sélectionner le type d’alimentation correspondant à l’installation et le modèle DPM correspondant exactement au matériel installé. Régler Current Transformer [Ratio/A] à 60. Appliquer ensuite les paramètres Modbus affichés ci-dessous.
```

Ne modifier aucune autre cellule de cette ligne.

- [ ] **Step 3: Relire la ligne après écriture**

Vérifier par lecture fraîche que les deux textes sont exacts et que `Unité=F2M-CFG-107`, `Statut=À valider` et `Valeur / choix attendu=Terminer` sont inchangés.

- [ ] **Step 4: Vérifier les dépendances de la fiche**

Relire :

```text
Reglages: F2M-CFG-107
Visuels_Terrain: Procedure_ID=F2M-PARAM-001, Step_ID=F2MP-010
Sources_Public: Step_IDs contient F2MP-010
Transitions_Diagnostic: F2MP010-END -> END
```

Expected: aucune dépendance n’a été supprimée ou renommée.

- [ ] **Step 5: Validation visuelle utilisateur**

Après déploiement, ouvrir `⚙️ Paramétrage F2M - Réglage DPM / Modbus` et vérifier :

```text
Titre principal : Réglage DPM / Modbus Free2move
Sous le titre : explication PowerUp dans le bloc hint
Bloc Réglages : valeurs PowerUp/Modbus lisibles
Visuel PowerUp : présent
Liens Gavazzi mono/tri : présents
Documentation F2M : présente
Bouton Terminer : présent
```

Ne passer `F2M-PARAM-001` en `Validé TechDiag` qu’après confirmation explicite de l’utilisateur.

---

### Task 4: Mettre la régression UI dans la CI et vérifier le build complet

**Files:**
- Modify: `.github/workflows/pages.yml`
- Verify: `build.js`, `index.html`, `settings.js`, tous les tests racine

**Interfaces:**
- Consumes: suite Node existante.
- Produces: le déploiement Pages bloque désormais aussi sur `ui.test.js`, afin qu’une future modification du moteur ne puisse casser silencieusement la lisibilité ou le routage.

- [ ] **Step 1: Modifier la commande de test du workflow**

Remplacer :

```yaml
- name: Test TechDiag
  run: node --test visual.test.js settings.test.js documentation-shared.test.js
```

par :

```yaml
- name: Test TechDiag
  run: node --test ui.test.js visual.test.js settings.test.js documentation.test.js documentation-shared.test.js summary.test.js
```

- [ ] **Step 2: Exécuter localement la même suite**

Run:

```bash
node --test ui.test.js visual.test.js settings.test.js documentation.test.js documentation-shared.test.js summary.test.js
```

Expected: PASS pour toute la suite.

- [ ] **Step 3: Construire l’artefact Pages**

Run:

```bash
node build.js
```

Expected: sortie `dist/index.html` générée sans erreur.

- [ ] **Step 4: Vérifier que le build contient les nouveaux comportements**

Contrôler dans `dist/index.html` :

```text
questionReadabilityClass
question compact
question dense
setting-value
```

et confirmer que les injections existantes `settings.js`, `visuals.js` et `documentation.js` sont toujours présentes.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "test: couvrir la lisibilite globale dans la CI"
```

- [ ] **Step 6: Ouvrir une PR et attendre les contrôles**

Créer une PR vers `main` avec un résumé limité à :

```text
- typographie adaptative des consignes longues
- hiérarchie légère des valeurs de réglage
- F2M-PARAM-001 utilisé comme premier cas de rédaction courte + hint
- aucune modification de logique métier ou de routage
```

Expected: tous les checks GitHub passent avant fusion.

- [ ] **Step 7: Fusionner et vérifier le déploiement GitHub Pages**

Après fusion, attendre la réussite du workflow `Deploy TechDiag to GitHub Pages`. Ne pas déclarer le rendu visuel validé tant que l’utilisateur ne l’a pas confirmé sur le site publié.

---

## Self-review de couverture

- Consigne principale courte : Task 1 + Task 3.
- Explication secondaire dans `hint` : Task 3, sans modification du mécanisme existant.
- Typographie adaptative pour les textes longs : Task 1.
- Pas de troncature : Task 1 l’interdit explicitement et les styles n’utilisent aucun clamp.
- Valeurs de réglage mieux hiérarchisées : Task 2.
- Conservation des visuels, documentation, détails et historique : aucune API de ces composants n’est modifiée ; Task 4 lance leurs tests.
- Compatibilité diagnostic Oui/Non et routage : `ui.test.js` reste dans la régression, Task 4.
- Mobile : styles dédiés Task 1 ; validation visuelle après déploiement.
- Déploiement progressif : Task 3 ne nettoie que `F2M-PARAM-001`; le reste reste inchangé jusqu’aux replays futurs.
