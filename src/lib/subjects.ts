// Shared list of school subjects (FR/AR) — used by admin UIs and import APIs.

export const SUBJECTS: { fr: string; ar: string }[] = [
  { fr: "Mathématiques", ar: "الرياضيات" },
  { fr: "Physique-Chimie", ar: "الفيزياء والكيمياء" },
  { fr: "SVT", ar: "علوم الحياة والأرض" },
  { fr: "Français", ar: "الفرنسية" },
  { fr: "Arabe", ar: "العربية" },
  { fr: "Anglais", ar: "الإنجليزية" },
  { fr: "Philosophie", ar: "الفلسفة" },
  { fr: "Histoire-Géo", ar: "التاريخ والجغرافيا" },
  { fr: "Économie", ar: "الاقتصاد" },
  { fr: "Informatique", ar: "المعلوميات" },
  { fr: "EPS", ar: "التربية البدنية" },
  { fr: "Mathématiques (TP)", ar: "الرياضيات (أعمال تطبيقية)" },
  { fr: "Physique (TP)", ar: "الفيزياء (أعمال تطبيقية)" },
  { fr: "Éducation Islamique", ar: "التربية الإسلامية" },
  { fr: "Éducation Civique", ar: "التربية المدنية" },
];

/** Arabic label of a subject given its French label (case-insensitive, accent-insensitive). */
export function subjectArFromFr(fr: string): string | null {
  const norm = (s: string) =>
    s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const target = norm(fr || "");
  if (!target) return null;
  const found = SUBJECTS.find((s) => norm(s.fr) === target);
  return found?.ar ?? null;
}
