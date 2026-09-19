#!/bin/bash
# Vérification E2E rapide : serveur dev + login + données depuis Neon PostgreSQL
cd /home/z/my-project

echo "=== 1. Arrêt d'un éventuel serveur existant ==="
pkill -f "next dev" 2>/dev/null; sleep 2

echo "=== 2. Démarrage du serveur dev ==="
rm -f dev.log
nohup bun run dev > /dev/null 2>&1 &
for i in $(seq 1 30); do
  sleep 2
  if curl -s -o /dev/null -w "" http://localhost:3000/api/auth/me 2>/dev/null; then
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me)
    if [ "$code" = "401" ] || [ "$code" = "200" ]; then echo "Serveur prêt (HTTP $code) après $((i*2))s"; break; fi
  fi
done

echo "=== 3. Login Surveillant ==="
curl -s -c /tmp/cookies-neon.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"surveillant@edu.ma","password":"surveillant123"}' \
  -o /tmp/login-resp.json -w "HTTP %{http_code}\n"
head -c 200 /tmp/login-resp.json; echo

echo "=== 4. GET /api/students (données Neon) ==="
curl -s -b /tmp/cookies-neon.txt http://localhost:3000/api/students \
  -o /tmp/students-resp.json -w "HTTP %{http_code}\n"
echo "Nombre d'élèves: $(grep -o '"codeMassar"' /tmp/students-resp.json | wc -l)"
echo "Premier élève: $(head -c 220 /tmp/students-resp.json)"

echo "=== 5. Preuve PostgreSQL dans dev.log ==="
grep -o 'FROM "public"\."[A-Za-z]*"' dev.log | sort | uniq -c | sort -rn | head -6
grep -c "PgBouncer\|DEALLOCATE" dev.log | xargs echo "Traces PgBouncer/pooler:"

echo "=== 6. GET /api/orientations ==="
curl -s -b /tmp/cookies-neon.txt http://localhost:3000/api/orientations \
  -o /tmp/orient-resp.json -w "HTTP %{http_code}\n"
echo "Orientations: $(grep -o '"status"' /tmp/orient-resp.json | wc -l)"
