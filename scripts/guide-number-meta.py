# Numérotation des pages + métadonnées du guide enseignant
# Schéma standard : couverture (p1) et page de clôture (dernière) non numérotées,
# corps numéroté 1..N-2 centré en bas. Puis métadonnées Title/Author/Subject/Creator.
import io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

SRC = "/home/z/my-project/download/guide-enseignant-ar/guide-enseignant.pdf"
DST = SRC  # réécriture in place après génération du buffer

reader = PdfReader(SRC)
writer = PdfWriter()
n = len(reader.pages)
media = reader.pages[0].mediabox
W, H = float(media.width), float(media.height)
print(f"pages={n} size={W:.1f}x{H:.1f}pt")

for i, page in enumerate(reader.pages):
    if 0 < i < n - 1:  # sauf couverture et clôture
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(W, H))
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(0.365, 0.42, 0.388)  # #5d6b63
        c.drawCentredString(W / 2, 16, str(i))
        c.save()
        buf.seek(0)
        overlay = PdfReader(buf).pages[0]
        page.merge_page(overlay)
    writer.add_page(page)

writer.add_metadata({
    "/Title": "دليل الاستخدام — نظام تدبير الغيابات المدرسية (للأساتذة)",
    "/Author": "Z.ai",
    "/Creator": "Z.ai PDF Workbench",
    "/Subject": "دليل عملي للأستاذ: الدخول، تدوين الغياب، التبرير، التذكير الآلي",
})

with open(DST, "wb") as f:
    writer.write(f)
print("numérotation + métadonnées OK")
