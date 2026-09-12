"use client";

// Printable orientation report — rendered inside a dialog for on-screen preview,
// and printed as a formal PDF document via window.print() (print CSS isolates .print-area).

import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Printer, Loader2, Download } from "lucide-react";
import { useRef, useState } from "react";
import { formatDateShort } from "@/lib/hooks";
import { exportElementToPdf } from "@/lib/pdf-export";

export interface PrintOrientation {
  id: string;
  title: string;
  content: string;
  source: string;
  status: string;
  createdAt: string | Date;
  signature?: string | null;
  thresholdAtCreation?: number | null;
  unjustifiedAbsences?: number;
  threshold?: number;
  student: {
    firstName: string;
    lastName: string;
    codeMassar: string;
    classe?: { code: string } | null;
    groupe?: { code: string } | null;
  };
  teacher?: {
    firstName: string;
    lastName: string;
    matiere: string;
    matiereAr?: string | null;
  } | null;
  session?: { date: string | Date; subject: string; subjectAr?: string | null } | null;
}

export function ReportPrintDialog({
  orientation,
  open,
  onOpenChange,
}: {
  orientation: PrintOrientation | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const docRef = useRef<HTMLDivElement | null>(null);

  if (!orientation) return null;
  const current = orientation;

  function print() {
    setPrinting(true);
    window.print();
    setTimeout(() => setPrinting(false), 500);
  }

  async function downloadPdf() {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      await exportElementToPdf(
        docRef.current,
        `rapport-orientation-${current.id.slice(-8).toUpperCase()}.pdf`
      );
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle>{t.reportPreview}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end gap-2 no-print">
          <Button variant="outline" onClick={downloadPdf} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 me-2" />
            )}
            {t.downloadPdf}
          </Button>
          <Button onClick={print} disabled={printing}>
            {printing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Printer className="h-4 w-4 me-2" />}
            {t.printPdf}
          </Button>
        </div>

        <div ref={docRef}>
          <ReportDocument orientation={orientation} locale={locale} t={t} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The formal document itself — isolated for printing */
export function ReportDocument({
  orientation,
  locale,
  t,
}: {
  orientation: PrintOrientation;
  locale: string;
  t: any;
}) {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  return (
    <div className="print-area rounded-lg border bg-white text-black p-6 sm:p-8" dir={dir}>
      {/* Header */}
      <div className="text-center">
        <div className="text-lg font-bold uppercase tracking-wide">
          {t.appSubtitle}
        </div>
        <div className="text-sm text-gray-600">{t.appName}</div>
        <div className="mt-3 inline-block border-2 border-black px-6 py-1.5 text-base font-bold">
          {isAr ? "تقرير توجيه" : "RAPPORT D'ORIENTATION"}
        </div>
      </div>

      <div className="mt-4 flex justify-between text-xs text-gray-600">
        <span>
          {t.reportRef}: <span className="font-mono">{orientation.id.slice(-8).toUpperCase()}</span>
        </span>
        <span>
          {t.date} : {formatDateShort(orientation.createdAt, locale)}
        </span>
      </div>

      <Separator className="my-4 bg-black/20" />

      {/* Student info */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <InfoLine label={t.student} value={`${orientation.student.lastName} ${orientation.student.firstName}`} />
        <InfoLine label={t.codeMassar} value={orientation.student.codeMassar} mono />
        <InfoLine label={t.classe} value={orientation.student.classe?.code ?? "—"} />
        <InfoLine
          label={t.groupe}
          value={orientation.student.groupe?.code ?? (isAr ? "بدون مجموعة" : "Sans groupe")}
        />
        {orientation.teacher && (
          <>
            <InfoLine
              label={t.teacher}
              value={`${orientation.teacher.lastName} ${orientation.teacher.firstName}`}
            />
            <InfoLine
              label={t.subject}
              value={
                isAr && orientation.teacher.matiereAr
                  ? orientation.teacher.matiereAr
                  : orientation.teacher.matiere
              }
            />
          </>
        )}
        {orientation.session && (
          <>
            <InfoLine label={t.date} value={formatDateShort(orientation.session.date, locale)} />
            <InfoLine
              label={t.subject}
              value={
                isAr && orientation.session.subjectAr
                  ? orientation.session.subjectAr
                  : orientation.session.subject
              }
            />
          </>
        )}
      </div>

      {/* Absence stats */}
      <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 p-3 text-sm">
        <div className="font-semibold mb-1">{t.absenceSummary} :</div>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-gray-800">
          <span>
            {t.unjustifiedAbsencesCount} : <b>{orientation.unjustifiedAbsences ?? "—"}</b>
          </span>
          <span>
            {t.threshold} : <b>{orientation.threshold ?? orientation.thresholdAtCreation ?? "—"}</b>
          </span>
        </div>
      </div>

      {/* Report title + content */}
      <div className="mt-4">
        <div className="text-sm font-bold mb-1">{orientation.title}</div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed min-h-[80px] border-t border-b border-gray-200 py-3">
          {orientation.content}
        </p>
      </div>

      {/* Status + signatures */}
      {orientation.signature ? (
        <div className="mt-6 grid grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              {isAr ? "الاستاذ" : "L'enseignant"}
            </div>
            { }
            <img
              src={orientation.signature}
              alt={isAr ? "التوقيع" : "Signature"}
              className="h-14 object-contain mb-1"
            />
            <div className="border-t border-gray-400 w-40" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-6">
              {isAr ? "الحراسة العامة" : "Le Surveillant"}
            </div>
            <div className="border-t border-gray-400 w-40" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-6">
              {isAr ? "خاتم المؤسسة" : "Cachet de l'établissement"}
            </div>
            <div className="border-t border-gray-400 w-40" />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-6">
              {isAr ? "الحراسة العامة" : "Le Surveillant"}
            </div>
            <div className="border-t border-gray-400 w-40" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-6">
              {isAr ? "خاتم المؤسسة" : "Cachet de l'établissement"}
            </div>
            <div className="border-t border-gray-400 w-40" />
          </div>
        </div>
      )}

      <div className="mt-4 text-center text-[10px] text-gray-400">
        {t.printedOn} {new Date().toLocaleString(isAr ? "ar-MA" : "fr-FR")}
      </div>
    </div>
  );
}

function InfoLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-gray-500 text-xs min-w-24">{label} :</span>
      <span className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
