"""Post-traitement numérotation WPS-safe :
1. Associe chaque sectPr (dans l'ordre) à son footer via document.xml.rels
2. Patche l'instrText : section 2 → PAGE \\* ROMAN, section 3 → PAGE \\* arabic
3. Supprime les <w:pgNumType/> vides (confusion WPS)
"""
import re, sys, zipfile, shutil

DOCX = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/guide-utilisation-enseignant-ar.docx"
TMP = DOCX + ".tmp"

with zipfile.ZipFile(DOCX, "r") as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

docxml = data["word/document.xml"].decode("utf-8")
rels = data["word/_rels/document.xml.rels"].decode("utf-8")

# 1. sectPr dans l'ordre du document
sects = re.findall(r"<w:sectPr(?:\s[^>]*)?>.*?</w:sectPr>", docxml, re.S)
print(f"sections trouvées : {len(sects)}")

# rId → cible footer
rel_map = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels))

def footer_files(sect_xml):
    ids = re.findall(r'<w:footerReference[^>]*r:id="([^"]+)"', sect_xml)
    return [rel_map[i].split("/")[-1] for i in ids if i in rel_map]

if len(sects) < 3:
    print("ERREUR : 3 sections attendues"); sys.exit(1)

f_toc = footer_files(sects[1])     # section TOC → ROMAN
f_body = footer_files(sects[2])    # section corps → arabic
print("footer TOC :", f_toc, "| footer corps :", f_body)

def patch_footer(fname, switch):
    key = "word/" + fname
    if key not in data:
        print("  introuvable :", key); return
    xml = data[key].decode("utf-8")
    # docx-js émet <w:instrText xml:space="preserve">PAGE</w:instrText> (ou avec espaces)
    new = re.sub(
        r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
        r"\g<1>PAGE \\* " + switch + r" \\* MERGEFORMAT\g<2>",
        xml,
    )
    if new != xml:
        data[key] = new.encode("utf-8")
        print(f"  {fname} → PAGE \\* {switch} OK")
    else:
        print(f"  {fname} : aucun champ PAGE nu trouvé (déjà patché ?)")

for f in f_toc:  patch_footer(f, "ROMAN")
for f in f_body: patch_footer(f, "arabic")

# 3. suppression des pgNumType vides
before = docxml
docxml = re.sub(r"<w:pgNumType\s*/>", "", docxml)
if docxml != before:
    print("pgNumType vides supprimés")
data["word/document.xml"] = docxml.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
shutil.move(TMP, DOCX)
print("post-traitement terminé")
