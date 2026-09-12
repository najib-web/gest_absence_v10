"use client";

// Export PDF d'un élément DOM (aperçu du rapport) via html2canvas-pro + jsPDF.
// html2canvas-pro est requis pour le support des couleurs oklch (Tailwind 4).

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

const MARGIN_MM = 8;        // marge de page
const TOLERANCE_MM = 12;    // tolérance de coupure entre pages
const JPEG_QUALITY = 0.92;

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const usableW = pageW - MARGIN_MM * 2;
  const usableH = pageH - MARGIN_MM * 2;

  const imgH = (canvas.height * usableW) / canvas.width;

  if (imgH <= usableH) {
    // Tout tient sur une page
    pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", MARGIN_MM, MARGIN_MM, usableW, imgH, undefined, "FAST");
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
      pdf.addImage(slice.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", MARGIN_MM, MARGIN_MM, usableW, sliceImgH, undefined, "FAST");
      first = false;
      y += sliceHpx;
    }
  }

  pdf.save(fileName);
}
