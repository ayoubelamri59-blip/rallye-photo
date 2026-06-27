# Rallye photo

Application de rallye photo pour groupes d'enfants — deux interfaces (organisateur / équipe) avec un seul code de partie, banque de défis, validation des photos et vote final.

## Configuration déjà faite

Les clés Supabase sont déjà branchées dans `src/shared.js`. Si tu veux changer de projet Supabase plus tard, modifie simplement les deux constantes en haut de ce fichier :

```js
export const SUPABASE_URL = '...';
export const SUPABASE_ANON_KEY = '...';
```

## Déployer sur Vercel (gratuit)

### 1. Mettre le code sur GitHub
- Crée un nouveau repository sur [github.com/new](https://github.com/new) (peut être privé)
- Depuis ce dossier, dans un terminal :
  ```bash
  git init
  git add .
  git commit -m "Rallye photo"
  git branch -M main
  git remote add origin https://github.com/TON_PSEUDO/NOM_DU_REPO.git
  git push -u origin main
  ```
  (Remplace l'URL par celle de ton repository)

  Pas envie d'utiliser le terminal ? Tu peux aussi glisser-déposer tous les fichiers directement sur la page GitHub via "Add file" → "Upload files".

### 2. Connecter Vercel
- Va sur [vercel.com](https://vercel.com) → connecte-toi avec ton compte GitHub
- "Add New" → "Project" → choisis ton repository `rallye-photo`
- Vercel détecte automatiquement que c'est un projet Vite — laisse les réglages par défaut
- Clique "Deploy"
- Après ~1 minute, tu obtiens une URL du type `https://rallye-photo.vercel.app`

### 3. C'est prêt
- Cette URL unique sert à la fois l'écran Organisateur et l'écran Équipe (l'utilisateur choisit en arrivant sur la page)
- Partage cette URL : toi tu cliques "Organisateur", les équipes cliquent "Équipe"

## Avant l'événement

N'oublie pas d'avoir fait, côté Supabase :
- Le script `schema.sql` exécuté dans le SQL Editor
- Un bucket de stockage nommé `rallye-photos`, marqué **Public**, créé dans Storage

## Développement local (optionnel)

Si tu veux tester sur ton ordinateur avant de déployer :
```bash
npm install
npm run dev
```
Puis ouvre l'URL affichée (généralement `http://localhost:5173`).
