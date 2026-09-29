// Génération version Word BILINGUE (FR | AR) du guide enseignant
// Route Create — recette R1 adaptée bilingue + palette verte MÉRS du guide PDF
// Contenu lu depuis guide-bilingue-content.json (extrait automatiquement du HTML source)
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, PageNumber, NumberFormat, AlignmentType,
  HeadingLevel, WidthType, BorderStyle, ShadingType, TableLayoutType,
  SectionType, TableOfContents,
} = require("docx");
const fs = require("fs");
const path = require("path");
const C = require("./guide-bilingue-content.json");

const IMG_DIR = "/home/z/my-project/download/formation/images";
const OUT = "/home/z/my-project/download/formation/guide-utilisation-enseignant-fr-ar.docx";

// ── Palette (identité MÉRS du guide PDF) ──
const P = {
  bg: "1A3C2A", accent: "5FA97C", stripe: "D5EAD8",
  h1: "1A3C2A", h2: "2D6B4A", text: "24312A", muted: "5D6B63",
  tipBg: "F2F8F4", tipLine: "2D6B4A", tipBorder: "DFE9E2", tipT: "1F5C48",
  coverTitle: "FFFFFF", coverSub: "CBDED3", coverMeta: "A8C3B3", coverFoot: "7E9C8B",
};

// Polices : FR Calibri ; AR = polices Office standard (cs = complex script)
const F_FR = { ascii: "Calibri", hAnsi: "Calibri" };
const F_AR = { ascii: "Calibri", hAnsi: "Calibri", cs: "Traditional Arabic" };
const F_ARH = { ascii: "Calibri", hAnsi: "Calibri", cs: "Sakkal Majalla" };

// ── Runs ──
function fr(text, o = {}) {
  return new TextRun({
    text, font: o.head ? F_FR : F_FR,
    size: o.size ?? 22, bold: o.bold ?? false, italics: o.italics ?? false,
    color: o.color ?? P.text, characterSpacing: o.characterSpacing,
  });
}
function ar(text, o = {}) {
  const size = o.size ?? 26;
  return new TextRun({
    text, rightToLeft: true, font: o.head ? F_ARH : F_AR,
    size, sizeComplexScript: size,
    bold: o.bold ?? false, boldComplexScript: o.bold ?? false,
    italics: o.italics ?? false, color: o.color ?? P.text,
  });
}

// ── Paragraphes ──
function frP(runs, o = {}) {
  return new Paragraph({
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    spacing: { line: 312, before: o.before ?? 0, after: o.after ?? 140 },
    indent: o.indent, border: o.border, keepNext: o.keepNext, keepLines: o.keepLines,
    heading: o.heading, children: Array.isArray(runs) ? runs : [runs],
  });
}
function arP(runs, o = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    spacing: { line: 312, before: o.before ?? 0, after: o.after ?? 140 },
    indent: o.indent, border: o.border, keepNext: o.keepNext, keepLines: o.keepLines,
    heading: o.heading, children: Array.isArray(runs) ? runs : [runs],
  });
}

// ── splitBi : sépare une chaîne mixte en {fr, ar} (cellules de tableaux, notes) ──
const RE_AR = /[\u0600-\u06FF\u0750-\u077F]/;
function splitBi(s) {
  s = (s || "").replace(/\s+/g, " ").trim();
  if (!s) return { fr: "", ar: "" };
  // « FR — AR » (en-têtes)
  if (s.includes(" — ")) {
    const i = s.indexOf(" — ");
    const left = s.slice(0, i), right = s.slice(i + 3);
    if (!RE_AR.test(left) && RE_AR.test(right)) return { fr: left.trim(), ar: right.trim() };
  }
  const startsAr = RE_AR.test(s[0]);
  for (let i = 1; i < s.length; i++) {
    const a = RE_AR.test(s[i - 1]), b = RE_AR.test(s[i]);
    if (a !== b) {
      const part1 = s.slice(0, i).trim(), part2 = s.slice(i).trim();
      return startsAr ? { ar: part1, fr: part2 } : { fr: part1, ar: part2 };
    }
  }
  return RE_AR.test(s) ? { fr: "", ar: s } : { fr: s, ar: "" };
}

// ── Couverture : calculs de mise en page (latin : ch ≈ pt×10.5) ──
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..." -–—·/:,;"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 38, minPt = 24) {
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / (pt * 10.5));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    lines = splitTitleLines(title, charsPerLine(titlePt));
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (13 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (11 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10.5 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}

// ── Recette R1 bilingue (couverture pleine page, marges 0) ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

function buildCoverBilingual(cfg) {
  const padL = 1200, padR = 900;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(cfg.titleFr, availableWidth, 38, 26);
  // titre AR découpé : « منظومة تدبير الغيابات » + « دليل استخدام الأستاذ(ة) »
  const arLines = cfg.titleAr.includes(" دليل ")
    ? [cfg.titleAr.slice(0, cfg.titleAr.indexOf(" دليل ")).trim(), cfg.titleAr.slice(cfg.titleAr.indexOf(" دليل ") + 1).trim()]
    : [cfg.titleAr];
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length + arLines.length, titlePt: Math.max(titlePt, 30),
    hasSubtitle: true, hasEnglishLabel: true, metaLineCount: 2, fixedHeight: 4400,
  });
  const accentB = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  // 1. espace haut
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. sur-titre bilingue avec filet accent
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: padL, right: padR }, spacing: { after: 500, line: 312 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [
      fr("GUIDE D'UTILISATION", { size: 21, bold: true, color: P.coverMeta, characterSpacing: 40 }),
      fr("   ·   ", { size: 21, color: P.coverMeta }),
      ar("دليل الاستخدام", { head: true, size: 24, bold: true, color: P.coverMeta }),
    ],
  }));

  // 3. titre FR (taille dynamique, ≤ 38 pt)
  titleLines.forEach((line, i) => {
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT, indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 80 : 260, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [fr(line, { size: titlePt * 2, bold: true, color: P.coverTitle })],
    }));
  });

  // 4. sous-titre FR
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT, indent: { left: padL, right: padR },
    spacing: { after: 520, line: 380, lineRule: "atLeast" },
    children: [fr(cfg.subFr, { size: 28, color: P.coverSub })],
  }));

  // 5. titre AR (aligné à droite, miroir du bloc FR)
  arLines.forEach((line, i) => {
    const isLast = i === arLines.length - 1;
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.START, indent: { right: padR },
      spacing: { after: isLast ? 300 : 80, line: Math.ceil((isLast ? 30 : 24) * 23), lineRule: "atLeast" },
      children: [ar(line, { head: true, size: (isLast ? 30 : 24) * 2, bold: isLast, color: P.coverTitle })],
    }));
  });

  // 6. résumé bilingue
  children.push(new Paragraph({
    alignment: AlignmentType.JUSTIFIED, indent: { left: padL, right: padR },
    spacing: { after: 160, line: 300 },
    children: [fr(cfg.sumFr, { size: 21, color: P.coverMeta })],
  }));
  children.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.JUSTIFIED, indent: { left: padL, right: padR },
    spacing: { after: 560, line: 320 },
    children: [ar(cfg.sumAr, { size: 23, color: P.coverMeta })],
  }));

  // 7. méta avec barre latérale accent (FR à gauche, AR à droite)
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT, indent: { left: padL, right: padR },
    border: { left: accentB }, spacing: { after: 80, line: 312 },
    children: [fr(cfg.metaFrLbl + " : ", { size: 21, bold: true, color: P.coverMeta }),
               fr(cfg.metaFrVal, { size: 21, color: P.coverMeta })],
  }));
  children.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.START, indent: { left: padL, right: padR },
    border: { right: accentB }, spacing: { after: 80, line: 312 },
    children: [ar(cfg.metaArLbl + " : ", { head: true, size: 23, bold: true, color: P.coverMeta }),
               ar(cfg.metaArVal, { size: 23, color: P.coverMeta })],
  }));

  // 8. espace bas
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 9. pied de couverture avec filet haut
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT, indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200, line: 312 },
    children: [
      fr(cfg.footFr, { size: 18, color: P.coverFoot }),
      fr("                                ", { size: 18 }),
      ar(cfg.footAr, { size: 20, color: P.coverFoot }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders, verticalAlign: "top", children,
      })],
    })],
  })];
}

// ── Briques du corps ──
function chapterHeading(tag, titleFr, titleAr) {
  return [
    new Paragraph({
      keepNext: true, spacing: { before: 400, after: 40, line: 312 },
      children: [fr(tag, { size: 18, bold: true, color: P.h2, characterSpacing: 30 })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1, keepNext: true,
      spacing: { after: 60, line: 460, lineRule: "atLeast" },
      children: [
        fr(titleFr, { size: 32, bold: true, color: P.h1 }),
        new TextRun({ break: 1, text: "", font: F_ARH }),
        ar(titleAr, { head: true, size: 30, bold: true, color: P.h2 }),
      ],
    }),
    new Paragraph({
      keepNext: true, spacing: { after: 220 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.stripe, space: 4 } },
      children: [],
    }),
  ];
}

function bodyDuo(b) {
  return [
    frP([fr(b.fr)], { after: 100 }),
    arP([ar(b.ar)], { after: 240 }),
  ];
}

function cellP(o) { // marges standard des cellules
  return { top: 120, bottom: 120, left: 180, right: 180, ...o };
}

function featureRow(f) {
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.h2 },
        margins: cellP({ left: 120, right: 120 }),
        width: { size: 8, type: WidthType.PERCENTAGE }, verticalAlign: "top",
        children: [new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { line: 312 },
          children: [fr(f.num, { size: 30, bold: true, color: "FFFFFF" })],
        })],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.tipBg },
        margins: cellP(), width: { size: 46, type: WidthType.PERCENTAGE }, verticalAlign: "top",
        children: [
          frP([fr(f.frT, { size: 22, bold: true, color: P.h1 })], { align: AlignmentType.LEFT, after: 40, keepNext: true }),
          frP([fr(f.frR, { size: 20, color: P.text })], { align: AlignmentType.LEFT, after: 0 }),
        ],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.tipBg },
        margins: cellP(), width: { size: 46, type: WidthType.PERCENTAGE }, verticalAlign: "top",
        children: [
          arP([ar(f.arT, { head: true, size: 24, bold: true, color: P.h1 })], { after: 40, keepNext: true }),
          arP([ar(f.arR, { size: 22 })], { after: 0 }),
        ],
      }),
    ],
  });
}
function featuresTable(items) {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED, borders: allNoBorders,
      rows: items.map(featureRow),
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

function stepParas(it) {
  return [
    frP([
      fr(it.num + ".  ", { size: 24, bold: true, color: P.h2 }),
      fr(it.frT + " ", { size: 22, bold: true, color: P.h1 }),
      fr(it.frR, { size: 22 }),
    ], { align: AlignmentType.LEFT, indent: { left: 200 }, after: 60, keepLines: true, keepNext: true }),
    arP([
      ar(it.num + ".  ", { head: true, size: 26, bold: true, color: P.h2 }),
      ar(it.arT + " ", { head: true, size: 25, bold: true, color: P.h1 }),
      ar(it.arR, { size: 25 }),
    ], { indent: { start: 240 }, after: 200 }),
  ];
}

let figN = 0;
function figure(b) {
  figN += 1;
  const buf = fs.readFileSync(path.join(IMG_DIR, path.basename(b.src)));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const dw = 560, dh = Math.round(dw * h / w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true,
      spacing: { before: 160, after: 100, line: 312 },
      children: [new ImageRun({ data: buf, transformation: { width: dw, height: dh }, type: "png" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 30, line: 280 },
      children: [
        fr("Figure " + figN + " — ", { size: 19, bold: true, color: P.h2 }),
        fr(b.capFr, { size: 19, color: P.muted }),
      ],
    }),
    new Paragraph({
      bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 260, line: 300 },
      children: [
        ar("صورة " + figN + " — ", { head: true, size: 21, bold: true, color: P.h2 }),
        ar(b.capAr, { size: 21, color: P.muted }),
      ],
    }),
  ];
}

function callout(b) {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: P.tipBorder },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: P.tipBorder },
        left: { style: BorderStyle.SINGLE, size: 24, color: P.tipLine },
        right: { style: BorderStyle.SINGLE, size: 4, color: P.tipBorder },
        insideHorizontal: NB, insideVertical: NB,
      },
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.tipBg },
          margins: { top: 140, bottom: 140, left: 220, right: 220 },
          width: { size: 100, type: WidthType.PERCENTAGE },
          children: [
            frP([fr(b.title, { size: 20, bold: true, color: P.tipT, characterSpacing: 20 })],
              { align: AlignmentType.LEFT, after: 80, keepNext: true }),
            frP([fr(b.fr, { size: 21 })], { align: AlignmentType.LEFT, after: 80 }),
            arP([ar(b.ar, { size: 24 })], { after: 0 }),
          ],
        })],
      })],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

function faq(b) {
  return [
    frP([
      fr(b.qFr, { size: 23, bold: true, color: P.h1 }),
      new TextRun({ break: 1, text: "", font: F_ARH }),
      ar(b.qAr, { head: true, size: 25, bold: true, color: P.h2 }),
    ], { align: AlignmentType.LEFT, keepNext: true, before: 180, after: 60 }),
    frP([
      fr(b.aFr, { size: 21 }),
      new TextRun({ break: 1, text: "", font: F_AR }),
      ar(b.aAr, { size: 24 }),
    ], { indent: { left: 280 }, after: 220 }),
  ];
}

function dataTable(rows) {
  const headerCells = rows[0].map((c, i) => {
    const s = c.mixed !== undefined ? splitBi(c.mixed) : { fr: c.fr || "", ar: c.ar || "" };
    return new TableCell({
      shading: { type: ShadingType.CLEAR, fill: P.stripe },
      margins: cellP(), width: { size: i === 0 ? 32 : 68, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        spacing: { line: 312 },
        children: [
          fr(s.fr, { size: 21, bold: true, color: P.h1 }),
          new TextRun({ break: 1, text: "", font: F_ARH }),
          ar(s.ar, { head: true, size: 23, bold: true, color: P.h1 }),
        ],
      })],
    });
  });
  const dataRows = rows.slice(1).map((r) => new TableRow({
    cantSplit: true,
    children: r.map((c, i) => {
      const s = c.mixed !== undefined ? splitBi(c.mixed) : { fr: c.fr || "", ar: c.ar || "" };
      const runsFr = s.fr ? [fr(s.fr, { size: 20 })] : [];
      const runsAr = s.ar ? [ar(s.ar, { size: 23 })] : [];
      return new TableCell({
        margins: cellP(), width: { size: i === 0 ? 32 : 68, type: WidthType.PERCENTAGE },
        verticalAlign: "top",
        children: [
          ...(runsFr.length ? [frP(runsFr, { align: AlignmentType.LEFT, after: s.ar ? 40 : 0 })] : []),
          ...(runsAr.length ? [arP(runsAr, { after: 0 })] : [new Paragraph({ children: [] })]),
        ],
      });
    }),
  }));
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: P.tipBorder },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: P.tipBorder },
        left: { style: BorderStyle.SINGLE, size: 4, color: P.tipBorder },
        right: { style: BorderStyle.SINGLE, size: 4, color: P.tipBorder },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.tipBorder },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: P.tipBorder },
      },
      rows: [new TableRow({ tableHeader: true, cantSplit: true, children: headerCells }), ...dataRows],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

// ── Assemblage du corps ──
const bodyChildren = [];
let stepsBuf = null, featBuf = null;
function flushSteps() {
  if (stepsBuf) { bodyChildren.push(...stepsBuf.flatMap(stepParas)); stepsBuf = null; }
}
function flushFeats() {
  if (featBuf) { bodyChildren.push(...featuresTable(featBuf)); featBuf = null; }
}
for (const ch of C.chapters) {
  flushSteps(); flushFeats();
  bodyChildren.push(...chapterHeading(ch.tag, ch.titleFr, ch.titleAr));
  for (const b of ch.blocks) {
    if (b.type === "duo") { flushSteps(); flushFeats(); bodyChildren.push(...bodyDuo(b)); }
    else if (b.type === "feature") { flushSteps(); featBuf = featBuf || []; featBuf.push(b); }
    else if (b.type === "steps") { flushFeats(); stepsBuf = stepsBuf || []; for (const it of b.items) stepsBuf.push(it); }
    else if (b.type === "fig") { flushSteps(); flushFeats(); bodyChildren.push(...figure(b)); }
    else if (b.type === "callout") { flushSteps(); flushFeats(); bodyChildren.push(...callout(b)); }
    else if (b.type === "faq") { flushSteps(); flushFeats(); bodyChildren.push(...faq(b)); }
    else if (b.type === "table") { flushSteps(); flushFeats(); bodyChildren.push(...dataTable(b.rows)); }
  }
}
flushSteps(); flushFeats();

// ── Page de clôture ──
function endingBlock() {
  const E = C.ending;
  const sub = splitBi(E.sub);
  const out = [];
  out.push(...chapterHeading("CONCLUSION · خاتمة", E.titleFr, E.titleAr));
  out.push(frP([fr(sub.fr, { size: 20, italics: true, color: P.muted })],
    { align: AlignmentType.CENTER, after: 40 }));
  out.push(arP([ar(sub.ar, { size: 22, italics: true, color: P.muted })],
    { align: AlignmentType.CENTER, after: 220 }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED, borders: allNoBorders,
    rows: E.cards.map((c) => new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.h2 },
          margins: cellP({ left: 120, right: 120 }),
          width: { size: 8, type: WidthType.PERCENTAGE }, verticalAlign: "top",
          children: [new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { line: 312 },
            children: [fr(c.n, { size: 30, bold: true, color: "FFFFFF" })],
          })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.tipBg },
          margins: cellP(), width: { size: 46, type: WidthType.PERCENTAGE }, verticalAlign: "top",
          children: [
            frP([fr(c.frT, { size: 22, bold: true, color: P.h1 })], { align: AlignmentType.LEFT, after: 40, keepNext: true }),
            frP([fr(c.frD, { size: 20 })], { align: AlignmentType.LEFT, after: 0 }),
          ],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.tipBg },
          margins: cellP(), width: { size: 46, type: WidthType.PERCENTAGE }, verticalAlign: "top",
          children: [
            arP([ar(c.arT, { head: true, size: 24, bold: true, color: P.h1 })], { after: 40, keepNext: true }),
            arP([ar(c.arD, { size: 22 })], { after: 0 }),
          ],
        }),
      ],
    })),
  }));
  out.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  const q = splitBi(E.quote);
  out.push(frP([fr(q.fr, { size: 26, bold: true, italics: true, color: P.h1 })],
    { align: AlignmentType.CENTER, before: 200, after: 60 }));
  out.push(arP([ar(q.ar, { head: true, size: 28, bold: true, color: P.h1 })],
    { align: AlignmentType.CENTER, after: 260 }));
  const sup = splitBi(E.support);
  out.push(frP([fr(sup.fr, { size: 21 })], { align: AlignmentType.CENTER, after: 40 }));
  out.push(arP([ar(sup.ar, { size: 23 })], { align: AlignmentType.CENTER, after: 0 }));
  return out;
}
bodyChildren.push(...endingBlock());

// ── Pieds de page (patchés ensuite par guide-word-pagenum.py : ROMAN / arabic) ──
const pageFooter = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.muted, font: F_FR })],
  })],
});
const bodyHeader = new Header({
  children: [new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.stripe, space: 4 } },
    spacing: { after: 0, line: 280 },
    children: [
      fr("Guide de l'enseignant — Gestion des absences scolaires", { size: 17, color: P.muted }),
      fr("     ", { size: 17 }),
      ar("دليل استخدام الأستاذ(ة) — منظومة تدبير الغيابات", { size: 19, color: P.muted }),
    ],
  })],
});
const emptyHF = { children: [] };

// ── Document ──
const doc = new Document({
  creator: "Z.ai",
  title: "Guide d'utilisation de l'enseignant — دليل استخدام الأستاذ(ة) (منظومة تدبير الغيابات)",
  description: "Guide bilingue français-arabe de la plateforme de gestion des absences scolaires — نسخة قابلة للتحرير",
  styles: {
    default: {
      document: {
        run: { font: F_FR, size: 22, color: P.text },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: F_FR, size: 32, bold: true, color: P.h1 },
        paragraph: { spacing: { before: 400, after: 60, line: 460 } },
      },
    },
  },
  features: { updateFields: true },
  sections: [
    { // Section 1 : couverture — marges 0, sans pied de page
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      headers: { default: new Header(emptyHF) },
      footers: { default: new Footer(emptyHF) },
      children: buildCoverBilingual({
        titleFr: C.cover.titleFr, titleAr: C.cover.titleAr, subFr: C.cover.subFr,
        sumFr: C.cover.sumFr, sumAr: C.cover.sumAr,
        metaFrLbl: C.cover.metaFrLbl, metaFrVal: C.cover.metaFrVal,
        metaArLbl: C.cover.metaArLbl, metaArVal: C.cover.metaArVal,
        footFr: C.cover.footFr, footAr: C.cover.footAr,
      }),
    },
    { // Section 2 : table des matières — chiffres romains
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pageFooter },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 300, line: 500, lineRule: "atLeast" },
          children: [
            fr("Table des matières", { size: 34, bold: true, color: P.h1 }),
            new TextRun({ break: 1, text: "", font: F_ARH }),
            ar("جدول المحتويات", { head: true, size: 32, bold: true, color: P.h1 }),
          ],
        }),
        new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-1" }),
        new Paragraph({
          spacing: { before: 300, line: 300 },
          children: [
            fr("Remarque : les numéros de page ci-dessus se mettent à jour dans Word — clic droit sur le tableau puis « Mettre à jour les champs ».",
              { size: 18, italics: true, color: P.muted }),
            new TextRun({ break: 1, text: "", font: F_AR }),
            ar("ملاحظة: تُحدَّث أرقام الصفحات في Word — انقر بزر الفأرة الأيمن على الجدول ثم اختر «تحديث الحقل».",
              { size: 20, italics: true, color: P.muted }),
          ],
        }),
      ],
    },
    { // Section 3 : corps — chiffres arabes, repart de 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: bodyHeader },
      footers: { default: pageFooter },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK —", OUT, (buf.length / 1024).toFixed(0) + " Ko");
});
