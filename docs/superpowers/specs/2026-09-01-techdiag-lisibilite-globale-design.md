# TechDiag — Refonte légère de lisibilité globale

Date : 2026-09-01

## Objectif

Améliorer la lisibilité de toutes les étapes TechDiag sans modifier la logique métier, le moteur de diagnostic, les transitions, les réponses disponibles ni l’identité visuelle générale de l’application.

L’interface actuelle est conservée. La refonte porte uniquement sur la hiérarchie de l’information : une étape doit être comprise immédiatement, sans gros pavé de texte en titre.

## Principe directeur

Chaque étape suit la règle suivante :

1. **Consigne principale courte** dans la zone `question`.
2. **Explication secondaire** dans la zone `hint` lorsqu’un contexte ou une précision est nécessaire.
3. **Valeurs de référence** dans les blocs de réglages existants (`Reglages`) plutôt que dans le titre.
4. **Visuels, documentation, détails techniques et historique** restent dans leurs composants actuels.

La refonte ne doit pas transformer TechDiag en fiche technique dense ni ajouter de nombreuses cartes ou étapes visuelles nouvelles.

## Règles de rédaction

### Question / action principale

La zone principale doit contenir une seule idée :

- une question ;
- une action ;
- ou un intitulé de référence.

Elle doit rester courte, idéalement sur une à trois lignes sur écran desktop.

Exemples :

- `Les paramètres Modbus du DPM sont-ils conformes ?`
- `Réglage DPM / Modbus Free2move`
- `Le délestage est-il efficace après redémarrage ?`

Elle ne doit pas contenir le chemin complet d’une application, plusieurs actions successives, une liste de valeurs ou une explication métier longue.

### Explication secondaire

Le bloc `hint` reçoit les informations nécessaires pour exécuter ou comprendre l’étape :

- chemin dans une application ;
- contexte de mesure ;
- critère de conformité ;
- ordre des contrôles ;
- avertissement court.

Exemple pour le module F2M :

> Dans PowerUp > Power Management > Dynamic Power Management, sélectionner le type d’alimentation et le modèle DPM correspondant au matériel installé. Régler Current Transformer [Ratio/A] à 60.

### Réglages attendus

Les valeurs fixes déjà présentes dans `Reglages` restent affichées dans le composant dédié.

Pour `F2M-CFG-107`, le bloc peut afficher notamment :

- DPM PowerMeter type : modèle correspondant au DPM installé ;
- Current Transformer [Ratio/A] : **60** ;
- Adresse : **001** ;
- Parité : **EVEN** ;
- Débit baud : **38.4**.

Les valeurs importantes doivent bénéficier d’un contraste typographique supérieur au texte explicatif, sans créer une nouvelle architecture d’écran.

## Comportement global

La règle de lisibilité doit être appliquée à toutes les procédures chargées depuis la base Google Sheets, quelle que soit la marque.

L’application ne doit pas dépendre d’une réécriture manuelle complète de chaque diagnostic pour obtenir un rendu lisible. Le moteur d’affichage doit également gérer les textes exceptionnellement longs de façon élégante.

### Gestion des textes longs

Si une question reste longue malgré la règle de rédaction :

- conserver la largeur actuelle du diagnostic ;
- réduire légèrement la taille de police selon un seuil de longueur ;
- maintenir une hauteur de ligne confortable ;
- ne jamais tronquer le contenu ;
- ne jamais masquer automatiquement une partie de la consigne.

Cette adaptation doit rester discrète et préserver le style actuel.

## Données et responsabilités

### Google Sheets

La base reste la source de vérité pour :

- `Instruction / question` ;
- `Condition / interprétation` ;
- `Valeur / choix attendu` ;
- `Reglages` ;
- sources, visuels et statuts.

Quand une étape mélange actuellement plusieurs niveaux d’information dans `Instruction / question`, les données pourront être nettoyées progressivement pendant les replays de diagnostic.

### Frontend

Le frontend fournit une protection globale contre les gros blocs difficiles à lire :

- classes de longueur pour la zone question ;
- typographie responsive ;
- maintien du bloc `hint` comme second niveau ;
- meilleure mise en évidence des valeurs du bloc `settingsReference`.

Il ne doit pas essayer de réinterpréter automatiquement la sémantique des phrases ni de découper une instruction en plusieurs morceaux à partir de ponctuation. La séparation métier reste pilotée par les données.

## Compatibilité avec les composants existants

La refonte conserve :

- le bandeau procédure et son statut ;
- l’indicateur d’étape ;
- les boutons de réponse ;
- le bloc `hint` ;
- `settingsReference` ;
- `stepVisual` ;
- la documentation fabricant ;
- `Détails techniques` ;
- `Déjà vérifié` ;
- Retour / Accueil ;
- le rendu mobile actuel.

Aucun nouveau format de données obligatoire n’est introduit pour cette première passe.

## Exemple cible — F2M Paramétrage DPM / Modbus

### Titre principal

`Réglage DPM / Modbus Free2move`

### Explication

`Dans PowerUp > Power Management > Dynamic Power Management, sélectionner le type d’alimentation et le modèle DPM correspondant au matériel installé. Régler Current Transformer [Ratio/A] à 60.`

### Bloc réglages

Réutiliser `F2M-CFG-107` pour afficher les valeurs PowerUp et Modbus.

### Éléments complémentaires

Conserver le visuel PowerUp, les visuels Gavazzi mono/tri, la documentation Free2move et le bouton Terminer dans leur logique actuelle.

## Tests

La refonte doit être couverte par des tests sur au moins les cas suivants :

1. question courte : rendu inchangé ;
2. question longue : classe de lisibilité appliquée sans troncature ;
3. présence d’un `hint` : affichage secondaire sous la consigne ;
4. bloc `Reglages` : valeurs clés visibles et hiérarchisées ;
5. procédure F2M Paramétrage : le gros paragraphe n’est plus utilisé comme titre ;
6. procédure de diagnostic classique avec boutons Oui/Non : aucun changement fonctionnel ;
7. rendu mobile : pas de débordement horizontal ni de texte illisible.

Les tests existants du moteur, des réglages, des visuels, de la documentation et du résumé doivent continuer à passer.

## Déploiement progressif

La première implémentation porte sur le moteur d’affichage global et sur le module `F2M-PARAM-001` utilisé comme cas de référence visuelle.

Après validation utilisateur du rendu, les textes des autres diagnostics seront nettoyés progressivement pendant leur replay, sans changer leur logique métier.

## Hors périmètre

Cette refonte n’inclut pas :

- nouvelle navigation ;
- transformation des diagnostics en checklist multi-cartes ;
- changement de couleurs global ;
- modification des arbres de diagnostic ;
- changement des conclusions ou règles métier ;
- réorganisation de la base Google Sheets ;
- nouvelle bibliothèque de composants lourde.
