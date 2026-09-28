// Génération version Word du guide enseignant (arabe RTL)
// Route Create — recette R1 (Pure Paragraph Left) adaptée RTL + palette verte MÉRS du guide
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, PageNumber, NumberFormat, AlignmentType,
  HeadingLevel, WidthType, BorderStyle, ShadingType, TableLayoutType,
  SectionType, TableOfContents,
} = require("docx");
const fs = require("fs");
const path = require("path");
const C = require("./guide-word-content.js");

const IMG_DIR = "/home/z/my-project/download/guide-enseignant-ar/images";
const OUT = "/home/z/my-project/download/guide-utilisation-enseignant-ar.docx";

// ── Palette (identité MÉRS du guide original) ──
const P = {
  bg: "1A3C2A",        // vert foncé couverture
  accent: "5FA97C",    // accent clair sur fond sombre
  stripe: "D5EAD8",    // lignes décoratives claires
  h1: "1A3C2A", h2: "2D6B4A", text: "24312A", muted: "5D6B63",
  tipBg: "EDF5F2", tipLine: "2A7A65", tipT: "1F5C48",
  warnBg: "FBF3E7", warnLine: "B97929", warnT: "8A6123",
  coverTitle: "FFFFFF", coverSub: "CBDED3", coverMeta: "A8C3B3", coverFoot: "7E9C8B",
};

// Polices arabes standard Windows/Office (cs = complex script)
const AR_BODY = { ascii: "Calibri", hAnsi: "Calibri", cs: "Traditional Arabic" };
const AR_HEAD = { ascii: "Calibri", hAnsi: "Calibri", cs: "Sakkal Majalla" };

// ── Helpers runs / paragraphs ──
function ar(text, o = {}) {
  const size = o.size ?? 26;
  const bold = o.bold ?? false;
  return new TextRun({
    text, rightToLeft: true,
    font: o.head ? AR_HEAD : AR_BODY,
    size, sizeComplexScript: size,
    bold, boldComplexScript: bold,
    italics: o.italics ?? false,
    color: o.color ?? P.text,
  });
}
// mini-markdown : **segment** = gras coloré
function md(text, o = {}) {
  return text.split("**").map((seg, i) =>
    i % 2 === 1
      ? ar(seg, { ...o, bold: true, color: o.boldColor ?? P.h2 })
      : ar(seg, o)
  ).filter((_, i, arr) => arr.length === 1 || true);
}
function rp(runs, o = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    spacing: { line: 312, before: o.before ?? 0, after: o.after ?? 160 },
    indent: o.indent,
    border: o.border,
    keepNext: o.keepNext, keepLines: o.keepLines,
    heading: o.heading,
    children: Array.isArray(runs) ? runs : [runs],
  });
}

// ── calcTitleLayout (adaptation arabe : ch ≈ pt×11.5) + splitTitleLines + calcCoverSpacing ──
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."،؛：！؟", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
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
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11.5; // arabe : caractères étroits et liés
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
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

// ── Recette R1 adaptée RTL (couverture pleine page, marges 0) ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

function buildCoverR1RTL(cfg) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(cfg.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  // desc ≈ 4 lignes 11pt + footer : hauteur fixe estimée
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: true, hasEnglishLabel: true, metaLineCount: cfg.metaLines.length,
    fixedHeight: 2500, marginTop: 0, marginBottom: 0,
  });
  const accentStart = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  // 1. espace haut dynamique
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. ligne ministérielle avec filet accent (bordure basse de paragraphe)
  children.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.START,
    indent: { left: padL, right: padR }, spacing: { after: 500, line: 312 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [ar(cfg.label, { size: 22, color: P.coverMeta })],
  }));

  // 3. titre (taille dynamique, jamais > 40pt)
  titleLines.forEach((line, i) => {
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.START,
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [ar(line, { head: true, size: titleSize, bold: true, color: P.coverTitle })],
    }));
  });

  // 4. sous-titre
  children.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.START,
    indent: { left: padL }, spacing: { after: 400, line: 380, lineRule: "atLeast" },
    children: [ar(cfg.subtitle, { head: true, size: 32, color: P.coverSub })],
  }));

  // 5. description
  children.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.JUSTIFIED,
    indent: { left: padL, right: padR }, spacing: { after: 700, line: 320 },
    children: [ar(cfg.desc, { size: 24, color: P.coverMeta })],
  }));

  // 6. lignes méta avec barre latérale accent
  for (const line of cfg.metaLines) {
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.START,
      indent: { left: padL + 200 }, spacing: { after: 80, line: 312 },
      border: { left: accentStart },
      children: [ar(line, { size: 22, color: P.coverMeta })],
    }));
  }

  // 7. espace bas dynamique
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 8. pied de couverture avec filet haut
  children.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.START,
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200, line: 312 },
    children: [
      ar(cfg.footerRight, { size: 18, color: P.coverFoot }),
      new TextRun({ text: "                                        ", size: 18 }),
      ar(cfg.footerLeft, { size: 18, color: P.coverFoot }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    visuallyRightToLeft: true,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        verticalAlign: "top",
        children,
      })],
    })],
  })];
}

// ── Briques du corps ──
function chapterHeading(tag, title) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1, bidirectional: true,
      alignment: AlignmentType.START, keepNext: true,
      spacing: { before: 360, after: 60, line: 420, lineRule: "atLeast" },
      children: [
        ar(tag + ": ", { head: true, size: 30, bold: true, color: P.h2 }),
        ar(title, { head: true, size: 32, bold: true, color: P.h1 }),
      ],
    }),
    new Paragraph({
      keepNext: true, spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.stripe, space: 4 } },
      children: [],
    }),
  ];
}
function bodyP(text) {
  return rp(md(text), { after: 180 });
}
function stepP(n, text) {
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.START, keepLines: true,
    spacing: { line: 312, after: 120 },
    indent: { start: 200 },
    children: [ar(n + ".  ", { head: true, size: 26, bold: true, color: P.h2 }), ...md(text)],
  });
}
function callout(tone, title, text) {
  const g = tone === "warn"
    ? { line: P.warnLine, bg: P.warnBg, t: P.warnT }
    : { line: P.tipLine, bg: P.tipBg, t: P.tipT };
  return [
    new Table({
      visuallyRightToLeft: true,
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: g.line },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: g.line },
        left: { style: BorderStyle.SINGLE, size: 6, color: g.line },
        right: { style: BorderStyle.SINGLE, size: 6, color: g.line },
        insideHorizontal: NB, insideVertical: NB,
      },
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: g.bg },
          margins: { top: 140, bottom: 140, left: 220, right: 220 },
          width: { size: 100, type: WidthType.PERCENTAGE },
          children: [
            rp([ar(title, { head: true, size: 26, bold: true, color: g.t })], { align: AlignmentType.START, after: 80, keepNext: true }),
            rp(md(text, { size: 24, boldColor: g.t }), { align: AlignmentType.START, after: 0 }),
          ],
        })],
      })],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}
function figure(file, num, caption) {
  const buf = fs.readFileSync(path.join(IMG_DIR, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const dw = 560, dh = Math.round(dw * h / w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true,
      spacing: { before: 160, after: 80, line: 312 },
      children: [new ImageRun({ data: buf, transformation: { width: dw, height: dh }, type: "png" })],
    }),
    rp([
      ar("شكل " + num + " — ", { head: true, size: 20, bold: true, color: P.h2 }),
      ...md(caption, { size: 20, color: P.muted, boldColor: P.muted }),
    ], { align: AlignmentType.CENTER, after: 240 }),
  ];
}
function faq(q, a) {
  return [
    rp([
      ar("س: ", { head: true, size: 26, bold: true, color: P.h2 }),
      ...md(q, { bold: true, color: P.h1, head: true, size: 26 }),
    ], { align: AlignmentType.START, keepNext: true, before: 120, after: 60 }),
    rp(md(a, { size: 26 }), { align: AlignmentType.START, indent: { start: 280 }, after: 200 }),
  ];
}
function summaryBlock() {
  const S = C.summary;
  const rows = S.steps.map((s, i) => new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.h2 },
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
        width: { size: 10, type: WidthType.PERCENTAGE },
        verticalAlign: "top",
        children: [new Paragraph({
          bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 312 },
          children: [ar(String(i + 1), { head: true, size: 30, bold: true, color: "FFFFFF" })],
        })],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.tipBg },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        width: { size: 90, type: WidthType.PERCENTAGE },
        verticalAlign: "top",
        children: [
          rp([ar(s.t, { head: true, size: 26, bold: true, color: P.tipT })], { align: AlignmentType.START, after: 40, keepNext: true }),
          rp([ar(s.d, { size: 24 })], { align: AlignmentType.START, after: 0 }),
        ],
      }),
    ],
  }));
  return [
    ...chapterHeading("خاتمة", S.title),
    rp([ar(S.sub, { size: 24, color: P.muted, italics: true })], { align: AlignmentType.START, after: 200 }),
    new Table({
      visuallyRightToLeft: true,
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: allNoBorders,
      rows,
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    rp([ar(S.closing, { head: true, size: 32, bold: true, color: P.h1 })], { align: AlignmentType.CENTER, before: 240, after: 80 }),
    rp([ar(S.org, { size: 22, color: P.muted })], { align: AlignmentType.CENTER, after: 0 }),
  ];
}

// ── Assemblage du corps ──
const bodyChildren = [];
for (const ch of C.chapters) {
  bodyChildren.push(...chapterHeading(ch.tag, ch.title));
  for (const b of ch.blocks) {
    if (b.type === "p") bodyChildren.push(bodyP(b.text));
    else if (b.type === "steps") b.items.forEach((it, i) => bodyChildren.push(stepP(i + 1, it)));
    else if (b.type === "fig") bodyChildren.push(...figure(b.file, b.num, b.caption));
    else if (b.type === "tip") bodyChildren.push(...callout("tip", b.title, b.text));
    else if (b.type === "warn") bodyChildren.push(...callout("warn", b.title, b.text));
    else if (b.type === "faq") bodyChildren.push(...faq(b.q, b.a));
  }
}
bodyChildren.push(...summaryBlock());

// ── Pieds de page (patchés ensuite : ROMAN / arabic) ──
const romanFooter = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.muted })],
  })],
});
const arabicFooter = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.muted })],
  })],
});
const bodyHeader = new Header({
  children: [new Paragraph({
    bidirectional: true, alignment: AlignmentType.START,
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.stripe, space: 4 } },
    spacing: { after: 0 },
    children: [ar("دليل الاستخدام — نظام تدبير الغيابات المدرسية", { size: 18, color: P.muted })],
  })],
});
const emptyHF = { children: [] };

// ── Document ──
const doc = new Document({
  creator: "Z.ai",
  title: "دليل الاستخدام — نظام تدبير الغيابات المدرسية (للأساتذة)",
  description: "دليل عملي لاستعمال نظام تدبير الغيابات المدرسية — نسخة قابلة للتحرير",
  styles: {
    default: {
      document: {
        run: { font: AR_BODY, size: 26, color: P.text },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: AR_HEAD, size: 32, bold: true, color: P.h1 },
        paragraph: { spacing: { before: 360, after: 60, line: 420 } },
      },
      heading2: {
        run: { font: AR_HEAD, size: 28, bold: true, color: P.h2 },
        paragraph: { spacing: { before: 240, after: 120, line: 380 } },
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
      children: buildCoverR1RTL(C.cover),
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
      footers: { default: romanFooter },
      children: [
        rp([ar("المحتويات", { head: true, size: 40, bold: true, color: P.h1 })],
          { align: AlignmentType.CENTER, after: 300 }),
        new TableOfContents("جدول المحتويات", { hyperlink: true, headingStyleRange: "1-1" }),
        rp([ar("ملاحظة: أرقام الصفحات في الجدول أعلاه تُحدَّث تلقائيا — انقر بزر الفأرة الأيمن على الجدول ثم اختر «تحديث الحقل».", { size: 20, italics: true, color: P.muted })],
          { align: AlignmentType.START, before: 300 }),
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
      footers: { default: arabicFooter },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK —", OUT, (buf.length / 1024).toFixed(0) + " Ko");
});
