import { NextRequest } from "next/server";
import { getCurrentUser, isSupervisor } from "@/lib/auth";
import * as XLSX from "xlsx";
import { HOUR_SLOTS, DAY_NAMES, minutesToLabel } from "@/lib/schedule";
import { buildServiceCellText } from "@/lib/excel";

/**
 * Downloadable Excel templates for the three imports, generated in the UI language.
 *  /api/templates/students?lang=fr|ar
 *  /api/templates/teachers?lang=fr|ar
 *  /api/templates/services?lang=fr|ar   ← weekly grid format (mirrors the UI grid)
 */

type Lang = "fr" | "ar";

interface TemplateDef {
  fileName: string;
  sheet: string;
  headers: string[];
  widths: number[];
  rows: (string | number)[][];
}

function buildStudents(lang: Lang): TemplateDef {
  if (lang === "ar") {
    return {
      fileName: "قائمة التلاميذ.xlsx",
      sheet: "التلاميذ",
      headers: ["الرمز المساري", "الاسم العائلي", "الاسم الشخصي", "القسم", "المستوى", "الاسم العائلي بالعربية", "الاسم الشخصي بالعربية", "هاتف ولي الأمر"],
      widths: [14, 16, 16, 12, 18, 18, 18, 16],
      rows: [
        ["R13000001", "Alaoui", "Youssef", "TCSF-1", "Tronc Commun", "العلوي", "يوسف", "0661234567"],
        ["R13000002", "Benjelloun", "Aya", "TCSF-1", "Tronc Commun", "بنجلون", "آية", "0662234567"],
      ],
    };
  }
  return {
    fileName: "ListEleve.xlsx",
    sheet: "Élèves",
    headers: ["Code Massar", "Nom", "Prénom", "Classe", "Niveau", "Nom (Arabe)", "Prénom (Arabe)", "Téléphone Parent"],
    widths: [14, 16, 16, 12, 18, 18, 18, 16],
    rows: [
      ["R13000001", "Alaoui", "Youssef", "TCSF-1", "Tronc Commun", "العلوي", "يوسف", "0661234567"],
      ["R13000002", "Benjelloun", "Aya", "TCSF-1", "Tronc Commun", "بنجلون", "آية", "0662234567"],
    ],
  };
}

function buildTeachers(lang: Lang): TemplateDef {
  if (lang === "ar") {
    return {
      fileName: "قائمة الأساتذة.xlsx",
      sheet: "الأساتذة",
      headers: ["رقم التأجير", "الاسم العائلي", "الاسم الشخصي", "الاسم العائلي بالعربية", "الاسم الشخصي بالعربية", "الهاتف", "المادة", "البريد الإلكتروني", "كلمة المرور"],
      widths: [12, 16, 16, 18, 18, 14, 18, 24, 14],
      rows: [
        ["123456", "Bennani", "Ahmed", "بناني", "أحمد", "0661234567", "Mathématiques", "a.bennani@edu.ma", ""],
        ["123457", "Chraibi", "Fatima Zahra", "الشرايبي", "فاطمة الزهراء", "0662234567", "Physique-Chimie", "", ""],
      ],
    };
  }
  return {
    fileName: "Liste enseignants.xlsx",
    sheet: "Enseignants",
    headers: ["PPR", "Nom", "Prénom", "Nom (Arabe)", "Prénom (Arabe)", "Téléphone", "Matière", "Email", "Mot de passe"],
    widths: [12, 16, 16, 18, 18, 14, 18, 24, 14],
    rows: [
      ["123456", "Bennani", "Ahmed", "بناني", "أحمد", "0661234567", "Mathématiques", "a.bennani@edu.ma", ""],
      ["123457", "Chraibi", "Fatima Zahra", "الشرايبي", "فاطمة الزهراء", "0662234567", "Physique-Chimie", "", ""],
    ],
  };
}

function buildServices(lang: Lang) {
  const dayNames = DAY_NAMES.map((d) => d[lang]);

  if (lang === "ar") {
    const header = ["التوقيت", ...dayNames];
    const notice = [
      "الجدول الأسبوعي للحصص — كل عمود يمثل يوماً (الاثنين ← السبت) وكل سطر يمثل ساعة (08:00 ← 18:00).",
      "محتوى الخلية: القسم | المجموعة | الأستاذ | المادة (المجموعة اختيارية) — مثال: TCSF-1 | G1 | Bennani Ahmed | الرياضيات",
      "حصة مدتها ساعتان: ادمج خليتين عمودياً (انظر مثال الاثنين 08:00 - 10:00).",
      "عدة حصص في نفس الخلية: افصل بينها بسطر من الشرطات (---).",
      "بعد تأكيد الاستيراد، يتم إنشاء جداول خدمة الأساتذة وتحديثها تلقائياً في قسم « الأساتذة وجداول الخدمة ».",
      "احذف الحصص النموذجية قبل الاستعمال الفعلي.",
    ];
    return { header, notice, lang };
  }

  const header = ["Créneau", ...dayNames];
  const notice = [
    "Grille horaire hebdomadaire — chaque colonne = un jour (Lundi → Samedi), chaque ligne = une heure (08:00 → 18:00).",
    "Contenu d'une case : Classe | Groupe | Enseignant | Matière (Groupe facultatif) — ex : TCSF-1 | G1 | Bennani Ahmed | Mathématiques",
    "Séance de 2h : fusionner verticalement les deux cases horaires (voir l'exemple Lundi 08:00 - 10:00).",
    "Plusieurs séances au même créneau : séparez-les par une ligne de tirets (---) dans la même case.",
    "Après confirmation de l'import, les Tables de Service des enseignants sont créées/mises à jour automatiquement dans la partie « Enseignants & Tables de Service ».",
    "Supprimez les séances d'exemple avant utilisation.",
  ];
  return { header, notice, lang };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isSupervisor(user)) {
    return new Response(JSON.stringify({ error: "Accès refusé" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { type } = await params;
  const lang: Lang = req.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "fr";

  // --- Special case: the services template is a weekly grid mirroring the UI ---
  if (type === "services") {
    const { header, notice, lang: l } = buildServices(lang);
    const isAr = l === "ar";
    const mat1 = isAr ? "الرياضيات" : "Mathématiques";
    const mat2 = isAr ? "الفيزياء والكيمياء" : "Physique-Chimie";

    const aoa: string[][] = [
      header,
      ...HOUR_SLOTS.map((h) => [
        `${minutesToLabel(h.startMin)} - ${minutesToLabel(h.endMin)}`,
        "",
        "",
        "",
        "",
        "",
        "",
      ]),
    ];
    // Example sessions (0-based aoa rows: header = 0, 08:00 row = 1, …)
    const tch1 = isAr ? "بناني أحمد" : "Bennani Ahmed";
    const tch2 = isAr ? "الشرايبي فاطمة الزهراء" : "Chraibi Fatima Zahra";
    aoa[1][1] = buildServiceCellText({ classe: "TCSF-1", groupe: null, teacher: tch1, matiere: mat1 }); // Lundi 08:00 → 2h (merged)
    aoa[3][1] = buildServiceCellText({ classe: "TCSF-2", groupe: null, teacher: tch2, matiere: mat2 }); // Lundi 10:00 → 1h
    aoa[7][2] = buildServiceCellText({ classe: "TCSF-1", groupe: "G1", teacher: tch1, matiere: mat1 }); // Mardi 14:00 → 1h

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [{ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }]; // Lundi 08:00-10:00
    ws["!cols"] = [{ wch: 16 }, ...Array.from({ length: 6 }, () => ({ wch: 32 }))];
    if (isAr) {
      (ws as unknown as { "!views": unknown[] })["!views"] = [{ RTL: true }];
    }
    XLSX.utils.book_append_sheet(wb, ws, isAr ? "الجدول" : "Grille");

    const noticeWs = XLSX.utils.aoa_to_sheet(notice.map((line) => [line]));
    noticeWs["!cols"] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, noticeWs, isAr ? "تعليمات" : "Notice");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const fileName = isAr ? "الجدول الأسبوعي.xlsx" : "grille horaire.xlsx";
    const encodedName = encodeURIComponent(fileName);

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template-services-${l}.xlsx"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store",
      },
    });
  }

  let def: TemplateDef;
  switch (type) {
    case "students":
      def = buildStudents(lang);
      break;
    case "teachers":
      def = buildTeachers(lang);
      break;
    default:
      return new Response(JSON.stringify({ error: "Type inconnu" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([def.headers, ...def.rows]);
  ws["!cols"] = def.widths.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, def.sheet);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const encodedName = encodeURIComponent(def.fileName);

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-${type}-${lang}.xlsx"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
