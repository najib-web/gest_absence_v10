# Gestion des Absences — Établissement Scolaire

Application web **bilingue Français / العربية (RTL)** de gestion des absences des élèves,
conçue pour trois rôles : **Directeur**, **Surveillant général** et **Enseignant**.
Installable sur téléphone (**PWA**) — Android et iOS.

## Fonctionnalités

### 🎓 Directeur
- Tableau de bord complet de surveillance + **gestion des comptes** :
  création de comptes surveillants/enseignants, réinitialisation des mots de passe, suppression.

### 🛡️ Surveillant général
- Élèves, classes, niveaux, groupes — **imports par fichiers modèles** (Excel/CSV).
- Enseignants + **tables de service** (imports fichiers).
- **Emploi du temps hebdomadaire** (Lun→Sam, 8h→18h, créneaux 1h/2h) avec détection de conflits.
- **Appel** par séance ou **supervision** temps réel de l'appel en cours.
- **Seuil d'absences** non justifiées → détection des dépassements → orientation en un clic.
- **Rapports d'orientation** des enseignants : consultation, impression PDF, traitement (Traité / En attente).
- Réinitialisation du **mot de passe des enseignants** (🔑 sur chaque ligne).
- Historique des absences (par code Massar / par classe et période) — **export Excel**.

### 📚 Enseignant
- Séance en cours / prochaine séance détectées automatiquement (**table de service**).
- **Appel** (présent / absent / retard / justifié, par classe ou par groupe) + orientation d'un élève avec **rapport**.
- **Rapports envoyés** au surveillant (statut) — **impression et téléchargement PDF** avec **signature manuscrite**.
- **Mon profil & signature** : signature dessinée au doigt/stylet, reprise sur tous les rapports PDF.
- Historique des absences + export Excel.

### 📱 PWA
- **Prompt d'installation** natif (Android/Chrome) + instructions iOS (Ajouter à l'écran d'accueil).
- Icônes adaptatives (any + maskable), page hors ligne, cache des ressources statiques.

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript
- **Tailwind CSS 4** + shadcn/ui · lucide-react
- **Prisma** + PostgreSQL (**Neon**) · i18n FR/AR avec RTL complet
- **PWA** : manifest, service worker, prompt d'installation
- PDF : `jspdf` + `html2canvas-pro` · Excel : `xlsx`

## Démarrage local

```bash
bun install
# Configurer la base : créer .env.neon avec DATABASE_URL=postgresql://... (voir .env.example)
bun run db:push
bun run dev        # http://localhost:3000
```

> `DATABASE_URL` est résolue par `src/lib/db-url.ts` (env → `.env.neon`). Aucun secret dans le code.

## Comptes par défaut (créés automatiquement)

| Rôle | Email | Mot de passe |
|---|---|---|
| Directeur | `directeur@edu.ma` | `directeur123` |
| Surveillant | `surveillant@edu.ma` | `surveillant123` |

> À changer avant une mise en service réelle (voir `DEPLOIEMENT.md`).

## Déploiement

Guide complet : **[DEPLOIEMENT.md](./DEPLOIEMENT.md)** (GitHub → Vercel → Neon).

## Structure

```
prisma/schema.prisma          # Modèles (User, Student, Teacher, Session, Absence, Orientation…)
src/app/api/                  # Routes API REST
src/components/admin/         # Vues Surveillant / Directeur
src/components/teacher/       # Vues Enseignant
src/components/pwa/           # Service worker register + prompt d'installation
src/lib/                      # db, auth, i18n FR/AR, excel, pdf-export, schedule…
public/icons/                 # Icônes PWA (SVG source + PNG)
public/templates/             # Fichiers modèles d'import
```
