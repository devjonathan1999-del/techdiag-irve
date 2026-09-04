# Refonte du module Peak Controller — parcours Mono / Tri

## Objectif

Le module `SCH-PEAK-PARAM-001` doit demander le type d'installation dès la première étape, puis conserver ce contexte jusqu'à la fin afin d'éviter tout mélange entre les parcours monophasé et triphasé.

## Parcours cible

1. Première question : `Monophasée` ou `Triphasée`.
2. La sélection est mémorisée dans `type_alimentation_peak_param`.
3. Après cette sélection, afficher un menu d'action propre à la branche :
   - `⚙️ Vérifier / régler le Peak Controller`
   - `🔗 Appairer le Peak Controller`
4. Le parcours monophasé utilise uniquement le modèle `EVA2HPC1`.
5. Le parcours triphasé utilise uniquement le modèle `EVA2HPC3`.
6. La question `Quel modèle de Peak Controller devez-vous appairer ?` disparaît du parcours utilisateur.
7. Les étapes communes d'appairage sont séparées par branche afin qu'aucun résultat, document ou visuel du parcours opposé ne puisse apparaître.
8. Après un appairage réussi, `Vérifier / régler le courant max` doit revenir directement à la question de puissance de la branche déjà sélectionnée, sans redemander Mono/Tri.
9. Les appels depuis `IRVE-DIAG-001 / DISJ-400` entrent désormais par la première question Mono/Tri.

## Répartition des étapes

### Entrée

- `SCHP-010` devient la première question Mono / Tri.
- `SCHP-M020` devient le menu d'action monophasé.
- `SCHP-T020` devient le menu d'action triphasé.

### Réglage

- Mono : `SCHP-110` → conclusions 3/6 kVA ou `SCHP-M130` pour les réglages autorisés.
- Tri : `SCHP-120` → conclusion 6/9 kVA ou `SCHP-130` pour les réglages autorisés.
- `SCHP-M130` affiche les réglages `EVA2HPC1` uniquement.
- `SCHP-130` reste la référence triphasée `EVA2HPC3` et conserve le visuel DIP triphasé.

### Appairage

- Mono : `SCHP-210` → `SCHP-M230` → `SCHP-M240` → `SCHP-M250` → `SCHP-M260` ou `SCHP-M270` → `SCHP-M280`.
- Tri : `SCHP-220` → `SCHP-230` → `SCHP-240` → `SCHP-250` → `SCHP-260` ou `SCHP-270` → `SCHP-280`.
- Les visuels `Appairage peak controller tri.png`, `tri 2.png` et `tri 3.png` restent exclusivement sur les étapes triphasées.

## Documentation

- Le document monophasé Schneider ne doit être assigné qu'aux étapes monophasées.
- Le document triphasé Schneider ne doit être assigné qu'aux étapes triphasées.
- Aucun document fabricant n'est affiché sur la toute première question Mono / Tri.

## Rappel de contexte

Sur toutes les étapes du module après sélection du type d'installation, afficher un petit rappel permanent :

- `Monophasé • EVA2HPC1`
- `Triphasé • EVA2HPC3`

Ce rappel est informatif uniquement et ne change pas la logique métier.

## Contraintes

- Conserver les règles de puissance et de réglage déjà validées.
- Conserver la règle globale d'UI : contenu principal → historique → documentation fabricant → `Terminer` / `Retour` / `Accueil`.
- Ne pas afficher de choix de modèle Peak Controller après la sélection Mono / Tri.
- Ne pas modifier les autres diagnostics TechDiag.
- La base Google Sheet reste la source canonique du parcours et des transitions.
