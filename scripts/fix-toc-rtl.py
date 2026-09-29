#!/usr/bin/env python3
"""Patche les entrées TOC placeholder du DOCX bilingue :
scinde le run « FR\\nAR » en run FR + <w:br/> + run AR (w:rtl + police cs),
pour un rendu RTL correct de l'arabe avant la mise à jour des champs dans Word."""
import re, sys, zipfile, shutil

DOCX = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/formation/guide-utilisation-enseignant-fr-ar.docx"
TMP = DOCX + ".tmp"
RE_AR = "[\u0600-\u06FF\u0750-\u077F]"

with zipfile.ZipFile(DOCX, "r") as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

xml = data["word/document.xml"].decode("utf-8")

# paragraphes TOC (pStyle 9/11/12) contenant un run « FR\nAR »
para_re = re.compile(r'(<w:p\b[^>]*>(?:(?!</w:p>).)*?w:pStyle w:val="(?:9|11|12)"(?:(?!</w:p>).)*?</w:p>)', re.S)
run_re = re.compile(r'<w:r>(?:<w:rPr>(?:(?!</w:rPr>).)*?</w:rPr>)?<w:t[^>]*>([^<]*)</w:t></w:r>', re.S)

def patch_para(p):
    changed = False
    def repl_run(m):
        nonlocal changed
        text = m.group(1)
        if "\n" not in text:
            return m.group(0)
        fr_part, ar_part = text.split("\n", 1)
        if not re.search(RE_AR, ar_part) or re.search(RE_AR, fr_part):
            return m.group(0)
        changed = True
        return (
            '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
            '<w:sz w:val="22"/></w:rPr>'
            f'<w:t xml:space="preserve">{fr_part}</w:t></w:r>'
            '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:cs="Sakkal Majalla" w:hAnsi="Calibri"/>'
            '<w:szCs w:val="24"/><w:rtl/></w:rPr>'
            f'<w:br/><w:t xml:space="preserve">{ar_part}</w:t></w:r>'
        )
    new = run_re.sub(repl_run, p)
    return (new, changed) if changed else (p, False)

count = 0
def para_sub(m):
    global count
    new, changed = patch_para(m.group(1))
    if changed:
        count += 1
    return new

xml = para_re.sub(para_sub, xml)
print(f"entrées TOC patchées : {count}")

data["word/document.xml"] = xml.encode("utf-8")
with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
shutil.move(TMP, DOCX)
print("patch TOC RTL terminé")
