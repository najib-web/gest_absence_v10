"use client";

// Palette d'édition des rapports — police, taille, style (G/I/S) et couleur du texte.
// Le style choisi est appliqué en direct à la zone de rédaction, mémorisé
// localement (localStorage) et enregistré avec le rapport (styleJson) afin
// d'être reproduit à l'identique sur l'aperçu A4 et le PDF imprimé.

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline } from "lucide-react";

export interface ReportStyle {
  font: string; // clé dans FONT_OPTIONS
  size: number; // pt
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string; // hex
}

export const DEFAULT_REPORT_STYLE: ReportStyle = {
  font: "times",
  size: 12,
  bold: false,
  italic: false,
  underline: false,
  color: "#000000",
};

const LS_KEY = "reportStyle.v1";

export const FONT_OPTIONS: { value: string; labelFr: string; labelAr: string; stack: string }[] = [
  { value: "times", labelFr: "Times New Roman", labelAr: "Times New Roman", stack: '"Times New Roman", Tinos, "Liberation Serif", Georgia, serif' },
  { value: "naskh", labelFr: "Noto Naskh (arabe)", labelAr: "نسخ عربي", stack: '"Noto Naskh Arabic", Amiri, "Traditional Arabic", "Times New Roman", serif' },
  { value: "arial", labelFr: "Arial", labelAr: "Arial", stack: 'Arial, "Liberation Sans", Helvetica, sans-serif' },
  { value: "calibri", labelFr: "Calibri", labelAr: "Calibri", stack: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  { value: "georgia", labelFr: "Georgia", labelAr: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { value: "tahoma", labelFr: "Tahoma", labelAr: "Tahoma", stack: 'Tahoma, Geneva, sans-serif' },
  { value: "courier", labelFr: "Courier New", labelAr: "Courier New", stack: '"Courier New", "Liberation Mono", monospace' },
];

export const SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

const COLOR_SWATCHES = [
  { value: "#000000", titleFr: "Noir", titleAr: "أسود" },
  { value: "#1f3864", titleFr: "Bleu foncé", titleAr: "أزرق داكن" },
  { value: "#7f1d1d", titleFr: "Rouge foncé", titleAr: "أحمر داكن" },
  { value: "#14532d", titleFr: "Vert foncé", titleAr: "أخضر داكن" },
  { value: "#7c2d12", titleFr: "Marron", titleAr: "بني" },
  { value: "#4b5563", titleFr: "Gris", titleAr: "رمادي" },
];

export function getFontStack(fontKey: string): string {
  return FONT_OPTIONS.find((f) => f.value === fontKey)?.stack ?? FONT_OPTIONS[0].stack;
}

export function getReportFontFamily(style?: string | null): string | null {
  const s = parseReportStyle(style);
  return s ? getFontStack(s.font) : null;
}

/** Parse le styleJson stocké côté serveur → ReportStyle (tolérant aux erreurs). */
export function parseReportStyle(styleJson?: string | null): ReportStyle | null {
  if (!styleJson) return null;
  try {
    const raw = JSON.parse(styleJson) as Partial<ReportStyle>;
    if (typeof raw !== "object" || raw === null) return null;
    return {
      font: typeof raw.font === "string" ? raw.font : DEFAULT_REPORT_STYLE.font,
      size: typeof raw.size === "number" && raw.size >= 6 && raw.size <= 40 ? raw.size : DEFAULT_REPORT_STYLE.size,
      bold: !!raw.bold,
      italic: !!raw.italic,
      underline: !!raw.underline,
      color: typeof raw.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.color) ? raw.color : DEFAULT_REPORT_STYLE.color,
    };
  } catch {
    return null;
  }
}

/** Propriétés CSS correspondant au style, pour la zone de saisie et le document imprimé. */
export function styleToCss(style: ReportStyle, baseFontFamily?: string): React.CSSProperties {
  return {
    fontFamily: getFontStack(style.font) || baseFontFamily,
    fontSize: `${style.size}pt`,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    color: style.color,
  };
}

/** Charge le style mémorisé localement (dernier choix de l'utilisateur). */
export function loadStoredReportStyle(): ReportStyle {
  if (typeof window === "undefined") return DEFAULT_REPORT_STYLE;
  try {
    const stored = window.localStorage.getItem(LS_KEY);
    if (stored) {
      const parsed = parseReportStyle(stored);
      if (parsed) return parsed;
    }
  } catch {}
  return DEFAULT_REPORT_STYLE;
}

export function storeReportStyle(style: ReportStyle): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(style));
  } catch {}
}

export function ReportStyleToolbar({
  value,
  onChange,
}: {
  value: ReportStyle;
  onChange: (s: ReportStyle) => void;
}) {
  const { t, locale } = useI18n();
  const [isAr, setIsAr] = useState(locale === "ar");

  useEffect(() => {
    setIsAr(locale === "ar");
  }, [locale]);

  const set = (patch: Partial<ReportStyle>) => {
    const next = { ...value, ...patch };
    onChange(next);
    storeReportStyle(next);
  };

  const fontLabel = (v: string) => {
    const f = FONT_OPTIONS.find((x) => x.value === v);
    return f ? (isAr ? f.labelAr : f.labelFr) : v;
  };

  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
        {t.reportStyle}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Police */}
        <Select value={value.font} onValueChange={(v) => set({ font: v })}>
          <SelectTrigger className="h-8 w-[150px] text-xs" title={t.fontFamily} aria-label={t.fontFamily}>
            <SelectValue>{fontLabel(value.font)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.stack }}>
                {isAr ? f.labelAr : f.labelFr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Taille */}
        <Select
          value={String(value.size)}
          onValueChange={(v) => set({ size: parseInt(v, 10) })}
        >
          <SelectTrigger className="h-8 w-[92px] text-xs" title={t.fontSize} aria-label={t.fontSize}>
            <SelectValue>{value.size} pt</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} pt
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Style : Gras / Italique / Souligné */}
        <div className="flex items-center rounded-md border overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-8 w-9 p-0 rounded-none font-bold ${value.bold ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
            onClick={() => set({ bold: !value.bold })}
            title={t.styleBold}
            aria-pressed={value.bold}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-8 w-9 p-0 rounded-none italic ${value.italic ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
            onClick={() => set({ italic: !value.italic })}
            title={t.styleItalic}
            aria-pressed={value.italic}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-8 w-9 p-0 rounded-none underline ${value.underline ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
            onClick={() => set({ underline: !value.underline })}
            title={t.styleUnderline}
            aria-pressed={value.underline}
          >
            <Underline className="h-4 w-4" />
          </Button>
        </div>

        {/* Couleur du texte : nuances officielles + sélecteur libre */}
        <div className="flex items-center gap-1.5" role="group" aria-label={t.textColor}>
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => set({ color: c.value })}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value.color.toLowerCase() === c.value ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              style={{ backgroundColor: c.value }}
              title={isAr ? c.titleAr : c.titleFr}
              aria-label={isAr ? c.titleAr : c.titleFr}
            />
          ))}
          <label
            className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/50 cursor-pointer relative overflow-hidden hover:scale-110 transition-transform"
            title={t.textColor}
          >
            <span
              className="absolute inset-0"
              style={{
                background:
                  "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
              }}
            />
            <input
              type="color"
              value={value.color}
              onChange={(e) => set({ color: e.target.value })}
              className="sr-only"
              aria-label={t.textColor}
            />
          </label>
        </div>

        {/* Aperçu du style courant */}
        <span
          className="text-xs text-muted-foreground ms-auto truncate max-w-[180px]"
          style={styleToCss(value)}
        >
          Aa Élan الاهتمام 123
        </span>
      </div>
    </div>
  );
}
