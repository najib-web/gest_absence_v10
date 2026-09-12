#!/usr/bin/env bash
# Résout l'URL PostgreSQL pour le CLI Prisma (db push, scripts d'import...).
# Priorité : DIRECT_DATABASE_URL (chaîne directe, recommandée CLI) > env
# POSTGRES_URL / DATABASE_URL (non-file:) > .env.neon > .env.local > .env
# Usage : export DATABASE_URL="$(bash scripts/db-url.sh)"
set -euo pipefail

cd "$(dirname "$0")/.."

usable() { [[ -n "$1" && "$1" != file:* && "$1" == postgresql*://* ]]; }

if usable "${DIRECT_DATABASE_URL:-}"; then echo "$DIRECT_DATABASE_URL"; exit 0; fi
if usable "${POSTGRES_URL:-}"; then echo "$POSTGRES_URL"; exit 0; fi
if usable "${DATABASE_URL:-}"; then echo "$DATABASE_URL"; exit 0; fi

for f in .env.neon .env.local .env; do
  if [[ -f "$f" ]]; then
    for key in DIRECT_DATABASE_URL POSTGRES_URL DATABASE_URL; do
      val=$(grep -E "^${key}=" "$f" | tail -1 | cut -d= -f2- | sed -e 's/"//g' -e "s/'//g" | xargs || true)
      if usable "$val"; then echo "$val"; exit 0; fi
    done
  fi
done

echo "ERREUR : URL PostgreSQL introuvable (env, .env.neon). Voir DEPLOIEMENT.md." >&2
exit 1
