# Écosphère

Écosphère est une simulation 2D d'écosystème vivant réalisée en HTML, CSS et JavaScript dans un seul fichier statique. Le projet met en scène des herbivores, des prédateurs, des ressources alimentaires dynamiques, des mutations légères, des événements écologiques, un cycle jour/nuit et une interface d'observation premium pensée comme un mini jeu de simulation contemplatif.

## Fonctionnalités

- Vue de dessus 2D avec rendu Canvas fluide et stylisé.
- Herbivores autonomes capables d'errer, fuir, chercher de la nourriture et se reproduire.
- Prédateurs avec logique de chasse, gestion de l'énergie et reproduction plus rare.
- Nourriture commune et rare, zones fertiles, lacs, repousse dynamique et pression écologique.
- Cycles de population visibles via statistiques et courbes en direct.
- Presets de démarrage : écosystème stable, surpopulation, monde hostile, prédateurs dominants, paradis fertile et mode personnalisé.
- Contrôles en temps réel pour densité de nourriture, agressivité, reproduction, vitesse de simulation, zoom, pause et réinitialisation.
- Événements activables : sécheresse, abondance, maladie, hiver, nouvelle meute, mutation rare et catastrophe locale.
- Sélection d'individus, suivi caméra, fiche détaillée, lignée simplifiée et export JSON du résumé statistique.
- Mode cinématique pour regarder le monde sans interface latérale.

## Structure

- `index.html` — application complète : interface, styles, moteur de simulation, rendu et logique UI.

## Lancer localement

Aucun build n'est nécessaire.

### Option 1

Ouvrez simplement `index.html` dans un navigateur moderne.

### Option 2

```bash
python3 -m http.server 8000
```

Puis ouvrez `http://localhost:8000`.

## Contrôles

- **Clic** sur une créature : sélectionner / suivre un individu.
- **Glisser-déposer** sur le monde : déplacer la caméra libre.
- **Molette** : zoom avant / arrière.
- **Pause / Reprise** : arrêter ou relancer la simulation.
- **x1 / x2 / x4 / x8** : accélérer l'évolution de l'écosystème.

## Export

Le bouton d'export génère un fichier JSON contenant le preset actif, la saison courante, les paramètres de simulation, les statistiques et un journal récent des événements.
