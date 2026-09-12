"use client";

// Export PDF d'un élément DOM (aperçu du rapport) via html2canvas-pro + jsPDF.
// html2canvas-pro est requis pour le support des couleurs oklch (Tailwind 4).

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

const MARGIN_MM = 8;        // marge de page par défaut
const TOLERANCE_MM = 12;    // tolérance de coupure entre pages
const JPEG_QUALITY = 0.92;

export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string,
  options?: { marginMm?: number }
) {
  // Un document déjà calé A4 (210 mm de large avec son propre padding) s'exporte
  // avec une marge nulle pour conserver un PDF A4 exact, sans double mise à l'échelle.
  const marginMm = options?.marginMm ?? MARGIN_MM;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const usableW = pageW - marginMm * 2;
  const usableH = pageH - marginMm * 2;

  const imgH = (canvas.height * usableW) / canvas.width;

  if (imgH <= usableH || imgH <= usableH * 1.02) {
    // Tout tient sur une page (tolérance 2 % pour éviter une page fantôme de quelques pixels)
    const drawH = Math.min(imgH, usableH);
    pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", marginMm, marginMm, usableW, drawH, undefined, "FAST");
  } else {
    // Pagination avec chevauchement de tolérance pour ne pas couper le texte
    const pxPerMm = canvas.width / usableW;
    const sliceHpx = Math.floor(usableH * pxPerMm);
    const overlapPx = Math.floor(TOLERANCE_MM * pxPerMm);

    let y = 0;
    let first = true;
    while (y < canvas.height) {
      const h = Math.min(sliceHpx + (y > 0 ? overlapPx : 0), canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      const sctx = slice.getContext("2d");
      if (!sctx) break;
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, slice.width, slice.height);
      sctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

      if (!first) pdf.addPage();
      const sliceImgH = (h * usableW) / canvas.width;
      pdf.addImage(slice.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", marginMm, marginMm, usableW, sliceImgH, undefined, "FAST");
      first = false;
      y += sliceHpx;
    }
  }

  pdf.save(fileName);
}
