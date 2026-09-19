import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff, resolveEtablissementId } from "@/lib/auth";
import { parseStudentExcel, deaccent } from "@/lib/excel";

/** Derive a standardized niveau (code + FR/AR labels) from a free-form label or a class code. */
function normalizeNiveau(label?: string, classeCode?: string): {
  code: string;
  labelFr: string;
  labelAr: string;
} {
  const n = deaccent(label || "");
  const cc = deaccent(classeCode || "");

  const isTC = /tronc|commun|(^|[^a-z])tc([^a-z]|$)/.test(n) || cc.startsWith("tc");
  const is1BAC =
    /^(1bac|1ere|1er|premiere)/.test(n.replace(/\s/g, "")) ||
    /premiere.*bac/.test(n.replace(/\s/g, "")) ||
    cc.startsWith("1bac");
  const is2BAC =
    /^(2bac|2eme|2em|deuxieme)/.test(n.replace(/\s/g, "")) ||
    /deuxieme.*bac/.test(n.replace(/\s/g, "")) ||
    cc.startsWith("2bac");

  if (isTC) return { code: "TC", labelFr: "Tronc Commun", labelAr: "الجذع المشترك" };
  if (is1BAC) return { code: "1BAC", labelFr: "1ère Année Bac", labelAr: "السنة الأولى باكالوريا" };
  if (is2BAC) return { code: "2BAC", labelFr: "2ème Année Bac", labelAr: "السنة الثانية باكالوريا" };

  // Unknown label → derive a stable code from the label (or the class code as last resort)
  const rawLabel = (label || classeCode || "").trim();
  const code = (n.replace(/[^a-z0-9]/g, "") || "AUTRE").slice(0, 12).toUpperCase();
  return { code, labelFr: rawLabel || "Autre", labelAr: rawLabel || "آخر" };
}

// Step 1: upload + parse, returns preview rows (no DB write yet)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // Héritage : les élèves importés par le directeur (ou son staff) sont
  // rattachés à son établissement (AREF + DP).
  const etabId = await resolveEtablissementId(user);
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "preview";
    const defaultClasseId = formData.get("classeId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { rows, detectedHeaders, totalRows } = parseStudentExcel(buffer);

    if (totalRows === 0) {
      return NextResponse.json({
        error: "Aucun élève trouvé dans le fichier. Vérifiez le format (colonnes: Code Massar, Nom, Prénom, Classe).",
        detectedHeaders,
      }, { status: 400 });
    }

    // Resolve classes by code (case/accent-insensitive) — dans l'établissement courant
    const classes = await db.classe.findMany({
      where: etabId ? { etablissementId: etabId } : {},
      include: { niveau: true, groups: true },
    });
    const classByCode = new Map<string, typeof classes[number]>();
    for (const c of classes) {
      classByCode.set(deaccent(c.code), c);
      classByCode.set(deaccent(c.code).replace(/\s/g, ""), c);
    }

    // Classes that do not exist yet will be auto-created on commit
    const missingClasses = new Set<string>();
    for (const r of rows) {
      const code = (r.classeCode || "").trim();
      if (!code) continue;
      const found =
        classByCode.get(deaccent(code)) || classByCode.get(deaccent(code).replace(/\s/g, ""));
      if (!found) missingClasses.add(code);
    }

    // Build enriched rows
    const enriched = rows.map((r) => {
      const code = (r.classeCode || "").trim();
      const classe = classByCode.get(deaccent(code)) || classByCode.get(deaccent(code).replace(/\s/g, "")) || null;
      const fallbackClasse = !classe && defaultClasseId
        ? classes.find((c) => c.id === defaultClasseId) || null
        : null;
      const finalClasse = classe || fallbackClasse;
      const willBeCreated = !finalClasse && !!code;
      const niveau = finalClasse?.niveau
        ? { labelFr: finalClasse.niveau.labelFr, labelAr: finalClasse.niveau.labelAr }
        : null;
      return {
        ...r,
        classeId: finalClasse?.id || null,
        classeLabel: finalClasse ? `${finalClasse.code}` : code || "—",
        classeWillBeCreated: willBeCreated,
        niveauLabel: niveau?.labelFr || r.niveauCode || "—",
        resolvable: !!finalClasse || willBeCreated,
      };
    });

    if (mode === "preview") {
      return NextResponse.json({
        rows: enriched,
        detectedHeaders,
        totalRows,
        classesToCreate: [...missingClasses].map((code) => {
          const nv = normalizeNiveau(
            rows.find((r) => (r.classeCode || "").trim() === code)?.niveauCode,
            code
          );
          return { code, niveauCode: nv.code, niveauLabel: nv.labelFr };
        }),
        classesAvailable: classes.map((c) => ({ id: c.id, code: c.code, label: c.labelFr })),
      });
    }

    // mode === "commit": insert into DB (+ auto-create missing niveaux & classes)
    let inserted = 0;
    let skipped = 0;
    let classesCreated = 0;
    const errors: string[] = [];

    // Niveau cache
    const niveauCache = new Map<string, { id: string }>();
    for (const n of await db.niveau.findMany()) niveauCache.set(n.code.toUpperCase(), n);

    async function resolveNiveau(label: string | undefined, classeCode: string) {
      const nv = normalizeNiveau(label, classeCode);
      const key = nv.code.toUpperCase();
      if (niveauCache.has(key)) return niveauCache.get(key)!;
      const created = await db.niveau.create({
        data: { code: nv.code, labelFr: nv.labelFr, labelAr: nv.labelAr },
        select: { id: true },
      });
      niveauCache.set(key, created);
      return created;
    }

    // Classe cache (per import run)
    const classeCache = new Map<string, { id: string } | null>();

    for (const r of enriched) {
      const code = (r.classeCode || "").trim();
      let classeId = r.classeId as string | null;

      if (!classeId && code) {
        const key = deaccent(code).replace(/\s/g, "");
        if (classeCache.has(key)) {
          classeId = classeCache.get(key)?.id ?? null;
        } else {
          // Check again in DB (may exist with unusual spacing) — établissement courant
          const existing = await db.classe.findFirst({
            where: {
              ...(etabId ? { etablissementId: etabId } : {}),
              OR: [{ code: { equals: code } }, { code: { equals: key } }],
            },
            select: { id: true },
          });
          if (existing) {
            classeCache.set(key, existing);
            classeId = existing.id;
          } else {
            const niveau = await resolveNiveau(r.niveauCode, code);
            const created = await db.classe.create({
              data: {
                code,
                labelFr: code,
                labelAr: code,
                niveauId: niveau.id,
                ...(etabId ? { etablissementId: etabId } : {}),
              },
              select: { id: true },
            });
            classeCache.set(key, created);
            classeId = created.id;
            classesCreated++;
          }
        }
      }

      if (!classeId) {
        skipped++;
        errors.push(`Classe introuvable pour ${r.firstName} ${r.lastName} (${r.classeCode})`);
        continue;
      }
      try {
        await db.student.upsert({
          where: { codeMassar: r.codeMassar.toUpperCase() },
          update: {
            firstName: r.firstName,
            lastName: r.lastName,
            classeId: classeId,
            ...(r.firstNameAr ? { firstNameAr: r.firstNameAr } : {}),
            ...(r.lastNameAr ? { lastNameAr: r.lastNameAr } : {}),
            ...(r.parentPhone ? { parentPhone: r.parentPhone } : {}),
          },
          create: {
            codeMassar: r.codeMassar.toUpperCase(),
            firstName: r.firstName,
            lastName: r.lastName,
            classeId: classeId,
            firstNameAr: r.firstNameAr || null,
            lastNameAr: r.lastNameAr || null,
            parentPhone: r.parentPhone || null,
            ...(etabId ? { etablissementId: etabId } : {}),
          },
        });
        inserted++;
      } catch (e) {
        skipped++;
        errors.push(`Erreur pour ${r.codeMassar}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      inserted,
      skipped,
      classesCreated,
      errors: errors.slice(0, 20),
      totalRows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur lors de l'import: " + (e as Error).message }, { status: 500 });
  }
}
