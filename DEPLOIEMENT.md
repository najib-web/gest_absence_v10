# Déploiement — GitHub + Vercel + Neon

Ce guide décrit la mise en production de l'application **Gestion des Absences** :
code sur **GitHub**, hébergement **Vercel**, base **PostgreSQL Neon**.

---

## 1. Architecture

| Élément | Rôle |
|---|---|
| **GitHub** | Dépôt du code source (aucun secret commité) |
| **Vercel** | Hébergement Next.js + déploiement automatique à chaque `git push` |
| **Neon** | Base PostgreSQL managée (`DATABASE_URL` définie chez Vercel uniquement) |

L'application lit la base via le résolveur `src/lib/db-url.ts` :
`POSTGRES_URL` → `DATABASE_URL` (env, non-SQLite) → `.env.neon` (local uniquement).
**Aucun identifiant n'est codé en dur dans le code.**

---

## 2. Sécurité — avant de pousser

- Les fichiers `.env`, `.env.neon`, `.env.local` sont **git-ignorés** (`.env*`) : ils ne quittent jamais la machine.
- Le mot de passe Neon figurant dans une chaîne partagée en clair **doit être réinitialisé** :
  Neon Console → votre projet → **Reset password** → mettez à jour `DATABASE_URL` chez Vercel.
- Mots de passe par défaut à changer avant mise en service réelle :
  - `directeur@edu.ma` / `directeur123` (Directeur)
  - `surveillant@edu.ma` / `surveillant123` (Surveillant)

---

## 3. Pousser le code sur GitHub

```bash
git init                       # si nécessaire
git add .
git commit -m "Gestion des Absences — prête pour déploiement"
git branch -M main
git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
git push -u origin main
```

Vérification avant push (aucun résultat attendu) :

```bash
git grep -i "postgres://" $(git rev-list --all) | grep -v "\.example"
```

---

## 4. Créer la base Neon

1. [console.neon.tech](https://console.neon.tech) → créer un projet (région au plus proche).
2. Récupérer la **chaîne poolée** (Dashboard → *Connection string* → cocher *Pooled connection*) :
   `postgresql://...@ep-xxxx-pooler.../gest_absence?sslmode=require`
3. Créer le schéma si la base est vide :

```bash
# En local — le CLI utilise la chaîne directe automatiquement (scripts/db-url.sh)
cp .env.neon .env.neon.local 2>/dev/null || true   # conserver la chaîne locale
bun run db:push
```

> La chaîne **poolée** (avec `-pooler` + `pgbouncer=true`) sert à l'application.
> La chaîne **directe** (sans `-pooler`) sert au CLI Prisma (`db push`, migrations).

---

## 5. Importer le projet dans Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → sélectionner le dépôt GitHub.
2. Vercel détecte Next.js — laisser les réglages par défaut.
3. **Environment Variables** → ajouter :

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | chaîne Neon **poolée** (`-pooler`, `sslmode=require`) |
   | `AUTH_SECRET` *(recommandé)* | chaîne aléatoire longue |

4. **Deploy**. Le build exécute automatiquement `postinstall → prisma generate`.

---

## 6. Vérifications après déploiement

- [ ] La page de connexion s'affiche (logo + bannière d'installation PWA).
- [ ] Connexion `directeur@edu.ma` → section **Comptes** visible (création surveillants, reset mots de passe).
- [ ] Connexion `surveillant@edu.ma` → élèves, appel, orientations ; bouton 🔑 sur chaque enseignant (reset mot de passe).
- [ ] Connexion enseignant → **Mon Profil & Signature** : dessiner la signature, puis envoyer un rapport d'orientation → **Télécharger PDF** contient la signature.
- [ ] Sur mobile : l'invite **« Installer l'application »** apparaît (Android/Chrome : bouton Installer ; iOS : étapes Partager → Sur l'écran d'accueil).
- [ ] `GET /manifest.json` et `/sw.js` renvoient 200.

---

## 7. Schéma de base (évolutions)

Le schéma Prisma est la source de vérité (`prisma/schema.prisma`, provider **postgresql**).
Après toute modification du schéma :

```bash
bun run db:push     # pousse le schéma vers Neon (chaîne directe via scripts/db-url.sh)
git push            # redéploie Vercel
```

> Note sandbox : si `DATABASE_URL=file:...sqlite` est injecté dans l'environnement,
> `scripts/db-url.sh` et `src/lib/db-url.ts` l'ignorent automatiquement et retombent
> sur `.env.neon` — aucun impact sur Vercel où `DATABASE_URL` est la vraie chaîne Neon.

---

## 8. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `URL PostgreSQL introuvable` au démarrage | `DATABASE_URL` absente | Définir la variable chez Vercel (poolée) / `.env.neon` en local |
| Erreur P1012 « URL must start with postgresql:// » | `DATABASE_URL=file:...sqlite` (SQLite) dans l'environnement | Le résolveur l'ignore déjà ; vérifier que `bun run db:push` passe par `scripts/db-url.sh` |
| Timeout Prisma sur Vercel | usage de la chaîne **directe** dans l'app | Utiliser la chaîne **poolée** (`-pooler`) pour `DATABASE_URL` |
| `prepared statement "s0" already exists` | PgBouncer transactionnel | Ajouter `&pgbouncer=true` à la chaîne poolée |
| Bannière PWA absente | site déjà installé ou visité en http | Vérifier https, `manifest.json`, service worker actif (DevTools → Application) |
| Le logo ne change pas après mise à jour | cache manifest/SW | Incrémenter `VERSION` dans `public/sw.js`, puis recharger deux fois |
