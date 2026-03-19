# Gravity Lab

Une mini simulation de gravité dans le navigateur, pensée pour quelqu'un qui part de zéro.

## Comment démarrer

1. Ouvre un terminal dans ce dossier.
2. Lance un petit serveur web local :

   ```bash
   python3 -m http.server 4173
   ```

3. Ouvre ton navigateur à l'adresse suivante :

   ```
   http://localhost:4173
   ```

## Quoi faire ensuite

- Clique sur **Démarrer**.
- Clique dans la grande zone de droite pour créer une explosion de particules.
- Essaie le bouton **Mode démo** si tu veux voir quelque chose d'impressionnant tout de suite.
- Change le **préréglage** pour tester rapidement plusieurs ambiances.
- Ajuste les curseurs pour apprendre visuellement ce que fait chaque paramètre.

## Si rien ne se passe

- Vérifie que le serveur est bien lancé dans le terminal.
- Vérifie que tu as ouvert `http://localhost:4173` dans le navigateur.
- Si l'écran est figé, clique sur **Démarrer** ou **Reprendre**.

## À quoi servent les options

- **Gravité** : vitesse de chute.
- **Débit de particules** : quantité ajoutée en continu.
- **Rebond** : intensité des rebonds.
- **Frottement** : ralentissement progressif.
- **Vent horizontal** : pousse les particules sur le côté.
- **Traînées** : effet visuel derrière les particules.
- **Attracteur souris** : attire les particules vers ta souris.
