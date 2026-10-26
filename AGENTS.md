# Règles de contribution — Qalam Motion

Ces règles s'appliquent à toute intervention dans ce dépôt. Les lire avant de
modifier un fichier. Une consigne plus locale peut les préciser, sans servir de
prétexte pour mélanger des tâches ou contourner les validations.

## 1. Une tâche, une branche, une pull request

- Traiter **une seule issue ou un seul objectif explicite à la fois**. Identifier
  au départ le résultat attendu, les critères d'acceptation et la branche cible.
- Une branche et sa PR portent un seul changement cohérent. Plusieurs fichiers,
  commits, tests et documents sont permis lorsqu'ils servent ce même objectif.
- Ne jamais ajouter une seconde correction, une nouvelle fonctionnalité, une
  refonte, un renommage ou un nettoyage sans lien direct avec l'objectif courant.
- Ne pas regrouper artificiellement plusieurs problèmes indépendants sous un
  titre général pour contourner cette règle.
- Si un autre problème est découvert, **le signaler sans le corriger** : expliquer
  le symptôme, l'impact et le lien éventuel avec le travail courant. Proposer un
  suivi distinct ; ne pas créer d'issue distante sans autorisation.
- Annoncer « je fais aussi cet autre fix » ne constitue pas une autorisation et
  ne permet pas de poursuivre hors périmètre.
- Si un prérequis indépendant bloque la tâche ou ses contrôles, présenter le
  blocage et demander un arbitrage. Le prérequis se traite dans sa propre branche
  et sa propre PR ; ne pas le glisser dans la PR en cours.
- Un changement de priorité demandé en cours de travail doit être clarifié :
  terminer l'objectif courant ou le mettre explicitement en pause avant de passer
  au suivant. Préserver les changements existants et les identifier clairement.
- Terminer une tâche signifie implémenter son périmètre, le vérifier, livrer sa PR
  dédiée lorsque demandé et indiquer les limites restantes. Une PR ouverte peut
  attendre une revue ; elle n'autorise pas à commencer spontanément une autre issue.
- Une nouvelle tâche autorisée repart d'une **nouvelle branche** depuis la bonne
  base. Ne pas recycler la branche d'une PR déjà livrée pour un autre correctif.
- La revue et les corrections de revue restent dans le périmètre de la PR. Un
  sujet distinct relevé en revue nécessite une autre PR.

## 2. Branches et isolation

- Branche d'intégration habituelle : `dev`. `main` est la branche de publication.
- Partir de la dernière version distante de la cible après `fetch`, puis créer une
  branche courte et descriptive : `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `chore/…`.
- Employer des noms neutres, en kebab-case, décrivant le travail. Ne pas attribuer
  une branche à un outil, un fournisseur ou un système de génération.
- Avant toute modification, vérifier le statut Git, la branche et le worktree.
  Ne jamais écraser, embarquer ou supprimer les changements d'une autre tâche.
- Pour une modification non triviale, utiliser un worktree dédié ou adopter celui
  déjà associé à la tâche. Ne pas imbriquer ou déplacer un worktree actif.
- Plusieurs contributeurs peuvent avancer sur leurs branches isolées. Ne pas
  modifier simultanément le même worktree ni mélanger leurs périmètres.
- Ne pas utiliser `reset --hard`, `clean`, un amend, un rebase de branche partagée
  ou un force push pour masquer un conflit ou réécrire le travail d'autrui.

## 3. Commits stricts

- Format : `type(scope optionnel): description`.
- Types autorisés : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `chore`, `revert`. Une amélioration fonctionnelle utilise `feat`.
- Description courte en **franglish**, avec **cinq mots maximum après le préfixe**.
  Exemples : `feat: add locale switch`, `fix: stabilize header layout`,
  `docs: clarify contribution rules`.
- Utiliser `!` seulement pour une véritable rupture de compatibilité.
- Chaque commit doit être cohérent et ne contenir que des fichiers du périmètre.
  Inspecter le diff et sélectionner explicitement les fichiers à indexer.
- Éviter les titres vagues tels que `update`, `misc fixes` ou `fix everything`.
- Garder l'identité Git humaine configurée ; ne jamais modifier l'auteur pour
  attribuer le travail à un outil. Ne pas ajouter de crédit de génération ni de
  trailer d'attribution automatique aux commits ou autres artefacts du dépôt.
- Ne jamais committer de secrets, `.env`, identifiants, données clients, exports,
  caches ou fichiers de build. Vérifier les fichiers non suivis avant de les ajouter.
- Ne pas utiliser `--no-verify`. Un hook ou contrôle en échec doit être compris et
  résolu dans le périmètre, ou signalé comme blocage. Ne pas cacher son résultat.
- Ne pas amender un commit sans demande explicite, ni publier automatiquement à
  la suite d'une simple demande de commit.

## 4. Push et pull requests obligatoires

- **Ne jamais pousser directement sur `main` ou `dev`**, y compris un petit fix,
  une documentation, une urgence ou un merge local. Ne pas utiliser de refspec
  détourné tel que `HEAD:dev`, de push forcé ou de contournement administratif.
- Toute intégration dans `dev` ou `main` passe par une **pull request** depuis une
  autre branche. Pour une release de `dev` vers `main`, utiliser aussi une PR.
- Une demande de push direct vers ces branches doit être reformulée en PR ; ne pas
  exécuter le push direct. Vérifier la destination réelle de chaque push.
- Pousser uniquement la branche de travail autorisée, avec une destination explicite.
  Une demande de créer une PR autorise le push de sa branche et la création de cette PR.
- Cibler `dev` par défaut. Une PR vers `main` nécessite une demande explicite de release.
- Titres de PR : même convention franglish, même type et même limite que les commits.
  Le titre décrit l'objectif réellement livré, pas une liste de sujets indépendants.
- Description : problème concret, comportement obtenu, issue liée, changements
  essentiels, contrôles exécutés et résultats, limites et validations humaines en attente.
  Écrire une prose claire en français avec les termes techniques usuels ; conserver
  de vrais retours à la ligne Markdown.
- Ne pas utiliser `Closes` ou `Fixes` si les critères de l'issue ne sont pas tous
  satisfaits. Utiliser une référence simple et préciser ce qui reste à traiter.
- Une demande de création de PR **n'autorise pas sa fusion**. Attendre une demande
  explicite pour fusionner cette PR ; un accord sur une ancienne PR ne s'étend pas à la suivante.
- Avant fusion, vérifier la cible, le dernier commit, l'absence de conflit et les
  contrôles/revues requis. Ne pas contourner un échec, une protection ou une revue requise.
- Après fusion confirmée, vérifier qu'aucun commit de la branche ne reste unique
  par rapport à la cible actualisée, puis nettoyer les branches locale/distante et
  faire `fetch --prune`. Ce nettoyage concerne seulement les branches temporaires
  de tâche : **ne jamais supprimer `main`, `dev` ni une branche partagée encore
  utilisée**, notamment après une PR de release `dev` vers `main`. En cas
  d'ambiguïté, conserver la branche et le signaler.
- Ne pas supprimer un worktree actif ou ses ressources sans confirmation de fin de
  tâche. Arrêter uniquement les processus dont l'appartenance a été établie.

## 5. Qualité et validation

- Utiliser **pnpm exclusivement**. Respecter le lockfile et les versions du dépôt ;
  ne pas mettre à jour des dépendances sans rapport avec la tâche.
- Conserver Next.js App Router à la racine dans `app/`, TypeScript strict et les
  conventions existantes. Réutiliser les composants et utilitaires avant d'en créer.
- Ne pas introduire `any`, de cast non sûr ou de désactivation de règle pour faire
  passer les contrôles. Commenter le pourquoi lorsqu'il n'est pas évident.
- Pour du code applicatif : lancer les contrôles pertinents du dépôt avant commit
  (`pnpm lint`, `pnpm typecheck`, `pnpm test`, et build/tests d'intégration selon le changement).
- Pour les pages, le routage ou le rendu public : vérifier aussi `pnpm build` et
  `pnpm test:http` contre l'aperçu de production. Ne pas confondre présence de texte
  dans un script d'hydratation et contenu visible dans le HTML.
- Pour une modification purement documentaire : vérifier le diff, la cohérence,
  les liens et la structure ; ne pas démarrer un serveur ni ajouter des tests artificiels.
- Préserver les quatre langues `en/ar/fr/es`, le RTL arabe, la navigation clavier,
  les focus et la réduction des animations. Toute nouvelle interface doit être utilisable sur mobile.
- Un formulaire asynchrone doit afficher pending/succès/erreur et empêcher les
  doubles soumissions. Une garde visuelle ne remplace pas l'autorisation côté serveur.
- Conserver les prix, offres et garanties métier existants. Les changements
  commerciaux, formulations religieuses, traductions finales, politiques et droits
  de portfolio nécessitent une validation humaine ; ne pas les inventer.
- Aucun déploiement, achat, changement de fournisseur, migration destructive ou
  modification de données de production n'est implicite dans une demande de code ou de PR.

## 6. Compte rendu et documentation de revue

- Annoncer le périmètre et signaler les blocages sans commencer une autre tâche.
- À la livraison, fournir le lien de la PR, sa source/cible, le résultat des contrôles
  réellement exécutés et les points restant à valider. Ne pas annoncer une réussite non vérifiée.
- Pour chaque nouvelle PR, inclure une explication HTML autonome du changement
  dans `docs/reviews/YYYY-MM-DD-<sujet>.html`, avec contexte, intuition, parcours des
  changements et cinq questions interactives. La versionner sur la même branche et
  lier sa version dans la description de la PR. Elle fait partie de la documentation
  du même objectif, pas d'un second correctif.
- Ces consignes guident les contributions. Elles ne remplacent pas les protections
  de branches ni les contrôles CI configurés dans GitHub.
