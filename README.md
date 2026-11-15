# GOLD PRONOS — Le Banquier

Application football mondiale, interface française, thème noir et or, pensée pour le web mobile et Android.

- **Application publiée :** https://dieudonnelebanquier7-hue.github.io/gold-pronos/
- **Dépôt :** https://github.com/dieudonnelebanquier7-hue/gold-pronos
- **Fuseau horaire par défaut :** Africa/Porto-Novo
- **Application installable :** Chrome Android → menu ⋮ → Installer l'application

## Fonctionnalités

- Calendrier de rencontres, filtres par date et compétition, recherche d'équipes.
- Scores en direct, statut et minute lorsque la source les communique.
- Pages de détails : statistiques, compositions, événements, forme et confrontations lorsqu'ils sont disponibles.
- Classements, clubs et sélections, buteurs et passeurs, actualités en français.
- Pronostics 1N2, double chance, buts et BTTS avec refus d'afficher une sélection lorsque l'échantillon ou les données vérifiées sont insuffisants.
- Favoris, compte, paramètres de langue et fuseau horaire, alertes locales.
- Version Android construite avec Capacitor via GitHub Actions.

## Sources de données

- **SportScore** : calendrier mondial, résultats et données en direct. API publique documentée : https://sportscore.com/developers/api/
  - L'offre gratuite annoncée est soumise à des limites d'utilisation et exige un lien visible « Powered by SportScore » vers https://sportscore.com/. Le lien est présent dans le pied de page.
  - Les données disponibles dépendent de la couverture de chaque compétition et ne constituent pas une garantie d'exhaustivité.
- **ESPN** : calendrier, scores et informations complémentaires via des endpoints publics non officiels. Ces endpoints peuvent évoluer, limiter les requêtes ou devenir indisponibles.
- **API-Football** : intégration conservée dans le code mais temporairement désactivée tant que le service sécurisé et les droits d'accès ne sont pas rétablis.

Les sources ne sont pas fusionnées aveuglément : les doublons sont rapprochés, les divergences de score sont signalées et les champs absents restent non disponibles. Aucun match, score, classement, effectif, blessure, cote ou statistique ne doit être inventé.

## Collecte et publication

Le workflow `.github/workflows/pages.yml` :
1. collecte les rencontres sur une fenêtre de 7 jours passés et 14 jours à venir ;
2. utilise SportScore pour les dates de la fenêtre et ESPN comme source de contrôle pour le jour courant ;
3. valide le format, l'unicité et la fraîcheur du calendrier ainsi que le budget de requêtes ;
4. vérifie les actualités en français ;
5. lance les tests navigateur avant de publier GitHub Pages.

La collecte complète planifiée est quotidienne à 23:00 UTC (00:00 au Bénin). L'application actualise séparément les scores en direct lorsqu'elle est ouverte.

## Contrôles locaux

Avec Node.js 22 :

```bash
node --check app.js
node --check auth.js
node --check i18n.js
node --check sw.js
node --check fetch-matches.cjs
node --check fetch-news.cjs
node fetch-matches.cjs
```

Les tests navigateur sont exécutés par GitHub Actions avec Playwright et Chromium. Les tests utilisent des fixtures de test pour les scénarios déterministes ; le workflow Pages vérifie aussi que le calendrier généré réellement s'affiche.

## Limites importantes

- Les quotas et la couverture des fournisseurs gratuits peuvent changer.
- Les compositions, blessures, statistiques avancées, cotes et données de tracking ne sont affichées que si une source les fournit réellement.
- Une probabilité ou un pronostic n'est jamais une certitude. Le produit ne doit pas promettre de gains.
- Les notifications locales dépendent du téléphone et de l'exécution de l'application. Les notifications push en arrière-plan nécessitent un service sécurisé correctement configuré.
- Toute monétisation doit respecter les conditions des fournisseurs de données, la réglementation locale et les règles des plateformes de paiement/publicité.

## Sécurité

Ne jamais committer de clé API, mot de passe, secret Supabase ou jeton GitHub dans le code client. Les secrets doivent rester dans les secrets GitHub ou dans la configuration sécurisée des fonctions serveur.
