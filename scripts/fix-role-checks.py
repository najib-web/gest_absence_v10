#!/usr/bin/env python3
"""Étend les checks de rôle SURVEILLANT aux DIRECTEUR via isStaff() dans les routes API.
Ne touche qu'aux checks du demandeur (user.role), jamais aux checks cibles (target.role)."""
import re
from pathlib import Path

BASE = Path("/home/z/my-project/src/app/api")

files = [p for p in BASE.rglob("route.ts") if "director" not in str(p)]

changed = []
for f in files:
    src = f.read_text()
    orig = src
    # 1) Remplace les checks du demandeur
    src = src.replace('user.role !== "SURVEILLANT"', "!isStaff(user.role)")
    # 2) Ajoute isStaff à l'import @/lib/auth si présent et pas déjà importé
    if "!isStaff(user.role)" in src and "isStaff" not in src.split("\n\n")[0] :
        pass  # handled below
    if "!isStaff(user.role)" in src and re.search(r'import \{ getCurrentUser \} from "@/lib/auth"', src):
        src = src.replace(
            'import { getCurrentUser } from "@/lib/auth"',
            'import { getCurrentUser, isStaff } from "@/lib/auth"',
        )
    elif "!isStaff(user.role)" in src and re.search(r'import \{ getCurrentUser,\s*\n?\s*isStaff \} from "@/lib/auth"', src):
        pass  # déjà correct
    if src != orig:
        f.write_text(src)
        changed.append(str(f.relative_to(BASE.parent.parent)))

print(f"{len(changed)} fichiers modifiés :")
for c in changed:
    print(" -", c)

# Vérification : plus aucun check SURVEILLANT-only sur user.role en dehors de director/
remaining = []
for f in BASE.rglob("route.ts"):
    for i, line in enumerate(f.read_text().splitlines(), 1):
        if 'user.role !== "SURVEILLANT"' in line:
            remaining.append(f"{f}:{i}")
print("\nChecks SURVEILLANT-only restants sur user.role :", remaining or "AUCUN")
