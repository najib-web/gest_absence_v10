"""Inspection visuelle rapide du guide régénéré (couverture, contenu, clôture)."""
import pypdfium2 as pdfium

PDF = "/home/z/my-project/download/guide-enseignant-ar/guide-enseignant.pdf"
OUT = "/home/z/my-project/scripts/inspect"

import os
os.makedirs(OUT, exist_ok=True)

pdf = pdfium.PdfDocument(PDF)
print(f"Pages: {len(pdf)}")
for i in [0, 1, 3, 5, 7, 10]:
    page = pdf[i]
    bitmap = page.render(scale=0.8)
    img = bitmap.to_pil()
    img.save(f"{OUT}/p{i+1:02d}.png")
    print(f"page {i+1}: {page.get_size()} renderée")
pdf.close()

# Vérif texte arabe non corrompu
from pypdf import PdfReader
r = PdfReader(PDF)
meta = r.metadata
print("Title:", meta.get("/Title"))
print("Author:", meta.get("/Author"))
print("Creator:", meta.get("/Creator"))
sample = r.pages[2].extract_text()[:120]
bad = sum(1 for c in sample if c == "\ufffd")
print(f"Échantillon p3: {len(sample)} chars, caractères corrompus: {bad}")
