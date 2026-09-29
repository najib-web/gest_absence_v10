#!/usr/bin/env python3
"""Extrait le contenu du guide bilingue FR/AR (HTML) vers un JSON structuré
pour la génération DOCX (scripts/guide-word-bilingue.js lit ce JSON)."""
import json
from bs4 import BeautifulSoup, NavigableString, Tag

SRC = "/home/z/my-project/download/formation/guide-enseignant-fr-ar.html"
OUT = "/home/z/my-project/scripts/guide-bilingue-content.json"

soup = BeautifulSoup(open(SRC, encoding="utf-8"), "html.parser")

def txt(el):
    return el.get_text(" ", strip=True) if el else ""

def clean(s):
    return " ".join(s.split()) if s else ""

def bold_split(el):
    """Retourne (titre_gras, reste) pour un bloc .fr/.ar avec <b>."""
    b = el.find("b")
    if not b:
        return None, clean(el.get_text(" ", strip=True))
    title = clean(b.get_text(" ", strip=True))
    rest = ""
    for node in b.next_siblings:
        rest += node.get_text(" ", strip=True) if isinstance(node, Tag) else str(node)
    return title, clean(rest)

# ── Couverture ──
cover_el = soup.find("div", class_="cover")
cover = {
    "kicker": txt(cover_el.find(class_="cover-kicker")),
    "titleFr": txt(cover_el.find(class_="cover-title-fr")),
    "titleAr": txt(cover_el.find(class_="cover-title-ar")),
    "subFr": txt(cover_el.find(class_="cover-sub-fr")),
    "subAr": txt(cover_el.find(class_="cover-sub-ar")),
    "sumFr": txt(cover_el.find(class_="cover-summary").find(class_="fr")) if cover_el.find(class_="cover-summary") else "",
    "sumAr": txt(cover_el.find(class_="cover-summary").find(class_="ar")) if cover_el.find(class_="cover-summary") else "",
    "pills": [txt(p) for p in cover_el.find_all(class_="pill")],
    "metaFrLbl": "", "metaFrVal": "", "metaArLbl": "", "metaArVal": "",
    "footFr": "", "footAr": "",
}
meta = cover_el.find(class_="cover-meta")
if meta:
    fr, ar = meta.find(class_="fr"), meta.find(class_="ar")
    lbl = fr.find(class_="lbl")
    cover["metaFrLbl"] = clean(lbl.get_text()) if lbl else ""
    if lbl: lbl.extract()
    cover["metaFrVal"] = clean(fr.get_text())
    lbl = ar.find(class_="lbl")
    cover["metaArLbl"] = clean(lbl.get_text()) if lbl else ""
    if lbl: lbl.extract()
    cover["metaArVal"] = clean(ar.get_text())
foot = cover_el.find(class_="cover-foot")
if foot:
    cover["footFr"] = clean(foot.find(class_="fr").get_text())
    cover["footAr"] = clean(foot.find(class_="ar").get_text())

# ── Corps : chapitres et blocs ──
main = soup.find("div", class_="main-content")
chapters, cur = [], None
steps_buf = None

def flush_steps():
    global steps_buf
    if steps_buf:
        cur["blocks"].append({"type": "steps", "items": steps_buf})
        steps_buf = None

for el in main.find_all(recursive=False):
    cls = el.get("class") or []
    name = cls[0] if cls else el.name
    if name == "chapter-header":
        flush_steps()
        cur = {"tag": txt(el.find(class_="chap-tag")),
               "titleFr": txt(el.find(class_="chap-titles").find(class_="fr")),
               "titleAr": txt(el.find(class_="chap-titles").find(class_="ar")),
               "blocks": []}
        chapters.append(cur)
    elif name == "duo":
        flush_steps()
        cur["blocks"].append({"type": "duo",
                              "fr": txt(el.find(class_="fr")),
                              "ar": txt(el.find(class_="ar"))})
    elif name == "feature":
        flush_steps()
        fr, ar = el.find(class_="fr"), el.find(class_="ar")
        frT, frR = bold_split(fr); arT, arR = bold_split(ar)
        cur["blocks"].append({"type": "feature", "num": txt(el.find(class_="num")),
                              "frT": frT, "frR": frR, "arT": arT, "arR": arR})
    elif name == "step":
        fr, ar = el.find(class_="fr"), el.find(class_="ar")
        frT, frR = bold_split(fr); arT, arR = bold_split(ar)
        if steps_buf is None: steps_buf = []
        steps_buf.append({"num": txt(el.find(class_="num")),
                          "frT": frT, "frR": frR, "arT": arT, "arR": arR})
    elif el.name == "figure":
        flush_steps()
        cap = el.find("figcaption")
        f = {"type": "fig", "src": el.find("img")["src"],
             "capFr": txt(cap.find(class_="fr")) if cap and cap.find(class_="fr") else txt(cap),
             "capAr": txt(cap.find(class_="ar")) if cap and cap.find(class_="ar") else ""}
        cur["blocks"].append(f)
    elif name == "callout":
        flush_steps()
        duo = el.find(class_="duo")
        cur["blocks"].append({"type": "callout", "cls": " ".join(cls),
                              "title": txt(el.find(class_="callout-title")),
                              "fr": txt(duo.find(class_="fr")) if duo else "",
                              "ar": txt(duo.find(class_="ar")) if duo else ""})
    elif name == "faq":
        flush_steps()
        q, a = el.find(class_="q"), el.find(class_="a")
        cur["blocks"].append({"type": "faq",
                              "qFr": txt(q.find(class_="fr")), "qAr": txt(q.find(class_="ar")),
                              "aFr": txt(a.find(class_="fr")), "aAr": txt(a.find(class_="ar"))})
    elif el.name == "table":
        flush_steps()
        rows = []
        for tr in el.find_all("tr"):
            cells = []
            for td in tr.find_all(["td", "th"]):
                fr, ar = td.find(class_="fr"), td.find(class_="ar")
                if fr and ar:
                    cells.append({"fr": txt(fr), "ar": txt(ar)})
                else:
                    cells.append({"mixed": txt(td)})
            rows.append(cells)
        cur["blocks"].append({"type": "table", "rows": rows})
    # .struct / décorations : ignorés
flush_steps()

# ── Page de clôture ──
ending_el = soup.find("div", class_="ending")
ending = {"titleFr": txt(ending_el.find(class_="ending-title-fr")),
          "titleAr": txt(ending_el.find(class_="ending-title-ar")),
          "sub": clean(ending_el.find(class_="ending-sub").get_text(" ", strip=True)),
          "quote": txt(ending_el.find(class_="ending-quote")),
          "support": clean(ending_el.find(class_="ending-support").get_text(" ", strip=True)),
          "footFr": "", "footAr": "", "cards": []}
foot = ending_el.find(class_="ending-foot")
if foot:
    ending["footFr"] = clean(foot.find(class_="fr").get_text()) if foot.find(class_="fr") else ""
    ending["footAr"] = clean(foot.find(class_="ar").get_text()) if foot.find(class_="ar") else ""
for card in ending_el.find_all(class_="recall-card"):
    fr, ar = card.find(class_="fr"), card.find(class_="ar")
    ending["cards"].append({
        "n": txt(card.find(class_="n")),
        "frT": clean(fr.get_text()) if fr else "",
        "arT": clean(ar.get_text()) if ar else ""})
    # titre = texte hors <small>, description = <small>
    c = ending["cards"][-1]
    if fr and fr.find("small"):
        c["frT"] = clean(fr.find(text=True, recursive=False)) if hasattr(fr, 'find') else c["frT"]
        sm = fr.find("small"); c["frT"] = clean(fr.get_text().replace(sm.get_text(), "", 1)) if sm else c["frT"]
        c["frD"] = clean(sm.get_text()) if sm else ""
    if ar and ar.find("small"):
        sm = ar.find("small"); c["arT"] = clean(ar.get_text().replace(sm.get_text(), "", 1))
        c["arD"] = clean(sm.get_text()) if sm else ""

data = {"cover": cover, "chapters": chapters, "ending": ending}
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ── Résumé de contrôle ──
print("JSON →", OUT)
print(f"Cover: titleFr={cover['titleFr']!r} titleAr={cover['titleAr']!r} subFr={cover['subFr'][:50]!r}")
print(f"  subAr={cover['subAr'][:50]!r} pills={cover['pills']}")
print(f"  meta: {cover['metaFrLbl']}={cover['metaFrVal']} / {cover['metaArLbl']}={cover['metaArVal']}")
print(f"  foot: {cover['footFr']!r} / {cover['footAr']!r}")
for ch in chapters:
    kinds = {}
    for b in ch["blocks"]:
        kinds[b["type"]] = kinds.get(b["type"], 0) + 1
    print(f"{ch['tag']}  «{ch['titleFr']}» / «{ch['titleAr']}»  → {kinds}")
print(f"Ending: {ending['titleFr']} / {ending['titleAr']}, cards={len(ending['cards'])}")
print(f"  quote={ending['quote'][:60]!r}")
print(f"  support={ending['support'][:80]!r}")
print(f"  footFr={ending['footFr'][:60]!r} footAr={ending['footAr'][:40]!r}")
for c in ending["cards"]:
    print("   carte", c["n"], "|", c.get("frT"), "|", c.get("frD", "?")[:40], "|", c.get("arT"), "|", c.get("arD", "?")[:20])
