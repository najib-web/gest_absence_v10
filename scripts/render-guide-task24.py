#!/usr/bin/env python3
"""Task 24 — rendu des pages du PDF guide bilingue pour inspection visuelle + scan U+FFFD."""
import sys, os
try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("pypdfium2 manquant")
import fitz  # pymupdf pour l'extraction texte (pypdf bugué sur polices variables)

PDF = "/home/z/my-project/download/guide-enseignant-fr-ar/guide-enseignant-fr-ar.pdf"
OUT = "/home/z/my-project/scripts/inspect/guide-fr-ar"
os.makedirs(OUT, exist_ok=True)

doc = fitz.open(PDF)
bad = 0
for i, page in enumerate(doc):
    text = page.get_text()
    if "\ufffd" in text:
        bad += 1
        print(f"page {i+1}: U+FFFD détecté !")
doc.close()

pdf = pdfium.PdfDocument(PDF)
for i in range(len(pdf)):
    page = pdf[i]
    bmp = page.render(scale=1.3)
    img = bmp.to_pil()
    p = os.path.join(OUT, f"p{i+1:02d}.png")
    img.save(p)
print(f"{len(pdf)} pages rendues dans {OUT}; pages avec U+FFFD: {bad}")
