#!/usr/bin/env python3
"""Analyse du fichier Liste_Eleves_2026-2027.xlsx avant import."""
import openpyxl
from collections import Counter

wb = openpyxl.load_workbook('/home/z/my-project/upload/Liste_Eleves_2026-2027.xlsx', read_only=True)
ws = wb['التلاميذ']

rows = list(ws.iter_rows(min_row=2, values_only=True))
total = len(rows)
codes = [str(r[0]).strip() for r in rows if r[0]]
classes = Counter(str(r[3]).strip() for r in rows if r[3])
niveaux = Counter(str(r[4]).strip() for r in rows if r[4])
phones = sum(1 for r in rows if r[7] and str(r[7]).strip())
no_code = sum(1 for r in rows if not r[0] or not str(r[0]).strip())
no_class = sum(1 for r in rows if not r[3] or not str(r[3]).strip())
no_last = sum(1 for r in rows if not r[1] or not str(r[1]).strip())
no_first = sum(1 for r in rows if not r[2] or not str(r[2]).strip())
no_ar = sum(1 for r in rows if (not r[5] or not str(r[5]).strip()) and (not r[6] or not str(r[6]).strip()))

dup = [c for c, n in Counter(codes).items() if n > 1]

print(f"Lignes de données      : {total}")
print(f"Codes Massar présents  : {len(codes)}  (vides: {no_code})")
print(f"Codes dupliqués        : {len(dup)} {dup[:5]}")
print(f"Nom latin manquant     : {no_last}")
print(f"Prénom latin manquant  : {no_first}")
print(f"Nom arabe manquant     : {no_ar}")
print(f"Téléphones présents    : {phones}")
print(f"Classe manquante       : {no_class}")
print(f"\nClasses ({len(classes)}) :")
for c, n in sorted(classes.items()):
    print(f"  {c:<15} {n}")
print(f"\nNiveaux ({len(niveaux)}) :")
for c, n in sorted(niveaux.items()):
    print(f"  {c:<25} {n}")

# aperçu téléphones
sample_phones = [str(r[7]).strip() for r in rows if r[7] and str(r[7]).strip()][:5]
if sample_phones:
    print(f"\nExemples téléphones    : {sample_phones}")
wb.close()
