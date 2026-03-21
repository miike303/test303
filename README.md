# Micro-organismes tactiles

Une expérience visuelle plein écran en HTML/CSS/JavaScript pur : des centaines de micro-points organiques restent dispersés dans un espace sombre, puis se rapprochent lentement du doigt ou de la souris maintenue, avec une transition colorée progressive à proximité du contact.

## Lancer le projet en local

Aucune installation n'est nécessaire.

- Ouvrez directement `index.html` dans un navigateur moderne.
- Ou servez le dossier avec un mini serveur statique, par exemple :

```bash
python3 -m http.server 8000
```

Puis ouvrez `http://localhost:8000`.

## Publication sur GitHub Pages

1. Créez un dépôt GitHub et poussez ces fichiers à la racine.
2. Dans **Settings > Pages**, choisissez :
   - **Source** : `Deploy from a branch`
   - **Branch** : `main` (ou votre branche par défaut)
   - **Folder** : `/ (root)`
3. Enregistrez. GitHub Pages publiera automatiquement le site.
4. Partagez ensuite l’URL GitHub Pages générée.

## Structure des fichiers

- `index.html` : structure minimale de la page, canvas plein écran et fallback.
- `style.css` : styles plein écran, fond sombre, indication discrète, optimisation tactile.
- `script.js` : moteur d’animation canvas, interactions tactiles/souris, logique des particules.
- `README.md` : documentation rapide et points d’ajustement.

## Réglages rapides

Les paramètres principaux sont regroupés dans l’objet `config` de `script.js`.

### Ajuster le nombre de points

Modifiez :

- `density`
- `minPoints`
- `maxPoints`

Plus `density` est faible, plus il y a de points.

### Ajuster la vitesse et l’inertie

Modifiez :

- `maxSpeed`
- `homePull`
- `friction`
- `interactionEase`

### Ajuster le rayon d’attraction

Modifiez :

- `influenceRadius`
- `colorRadius`
- `haloRadius`

### Ajuster la palette

Modifiez dans `config.colors` :

- `rest` pour la teinte au repos
- `cool` pour la proximité intermédiaire
- `hot` pour la proximité très forte

## Notes techniques

- Rendu en `Canvas 2D` pour rester simple et performant.
- Utilisation de `requestAnimationFrame`.
- Gestion du `devicePixelRatio` pour les écrans Retina.
- Compatible tactile mobile et souris desktop.
- Sans dépendance externe, prêt pour GitHub Pages.
