import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff, resolveEtablissementId } from "@/lib/auth";
import { parseTeachersExcel, deaccent } from "@/lib/excel";
import { subjectArFromFr } from "@/lib/subjects";

const DEFAULT_TEACHER_PASSWORD = "enseignant123";

/** Slugify a name for email generation: keep a-z0-9, join with dots. */
function slugName(s: string): string {
  return deaccent(s)
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, ".");
}

async function findFreeEmail(base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  // Guard against infinite loops
  while (n < 100) {
    const existing = await db.user.findUnique({ where: { email: candidate } });
    if (!existing) return candidate;
    candidate = base.replace(/@/, `${n}@`);
    n++;
  }
  return `${Date.now()}@edu.ma`;
}

// Step 1: upload + parse, returns preview rows (no DB write yet)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // Héritage : les enseignants importés par le directeur (ou son staff) sont
  // rattachés à son établissement (AREF + DP).
  const etabId = await resolveEtablissementId(user);
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "preview";

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { rows, detectedHeaders, totalRows } = parseTeachersExcel(buffer);

    if (totalRows === 0) {
      return NextResponse.json({
        error:
          "Aucun enseignant trouvé dans le fichier. Vérifiez le format (colonnes: Nom, Prénom, Matière).",
        detectedHeaders,
      }, { status: 400 });
    }

    // Enrich rows: final email (generated if missing), arabic subject, validity
    const enriched = [] as {
      index: number;
      firstName: string;
      lastName: string;
      matiere: string;
      ppr?: string;
      firstNameAr?: string;
      lastNameAr?: string;
      phone?: string;
      matiereAr: string | null;
      emailInput: string;
      email: string;
      emailGenerated: boolean;
      password: string;
      valid: boolean;
      errorCode?: string;
    }[];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const missingName = !r.firstName && !r.lastName;
      const missingMatiere = !r.matiere;
      const emailGenerated = !r.email;
      const baseEmail = r.email
        ? r.email.toLowerCase().trim()
        : `${slugName(r.firstName || r.lastName)}.${slugName(r.lastName || r.firstName)}@edu.ma`;
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(baseEmail);

      let errorCode: string | undefined;
      if (missingName && missingMatiere) errorCode = "MISSING_FIELD";
      else if (missingName) errorCode = "NAME_MISSING";
      else if (missingMatiere) errorCode = "MATIERE_MISSING";
      else if (!emailValid) errorCode = "EMAIL_INVALID";

      enriched.push({
        index: i,
        firstName: r.firstName,
        lastName: r.lastName,
        matiere: r.matiere,
        ppr: r.ppr,
        firstNameAr: r.firstNameAr,
        lastNameAr: r.lastNameAr,
        phone: r.phone,
        matiereAr: subjectArFromFr(r.matiere),
        emailInput: r.email || "",
        email: baseEmail,
        emailGenerated,
        password: r.password || DEFAULT_TEACHER_PASSWORD,
        valid: !errorCode,
        errorCode,
      });
    }

    if (mode === "preview") {
      return NextResponse.json({
        rows: enriched,
        detectedHeaders,
        totalRows,
        defaultPassword: DEFAULT_TEACHER_PASSWORD,
      });
    }

    // mode === "commit": create/update users + teachers
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const r of enriched) {
      if (!r.valid) {
        skipped++;
        errors.push(
          `Ligne ${r.index + 1} (${r.firstName} ${r.lastName}): champs manquants ou email invalide`
        );
        continue;
      }
      try {
        const existingUser = await db.user.findUnique({
          where: { email: r.email },
          include: { teacher: true },
        });

        if (existingUser) {
          // Update the teacher profile when the account already exists
          if (existingUser.teacher) {
            await db.teacher.update({
              where: { id: existingUser.teacher.id },
              data: {
                firstName: r.firstName || existingUser.teacher.firstName,
                lastName: r.lastName || existingUser.teacher.lastName,
                matiere: r.matiere,
                matiereAr: r.matiereAr,
                ...(r.ppr ? { ppr: r.ppr } : {}),
                ...(r.firstNameAr ? { firstNameAr: r.firstNameAr } : {}),
                ...(r.lastNameAr ? { lastNameAr: r.lastNameAr } : {}),
                ...(r.phone ? { phone: r.phone } : {}),
              },
            });
            updated++;
          } else if (existingUser.role === "ENSEIGNANT") {
            await db.teacher.create({
              data: {
                userId: existingUser.id,
                firstName: r.firstName || existingUser.name.split(" ")[0] || "—",
                lastName: r.lastName || existingUser.name.split(" ").slice(1).join(" ") || "—",
                matiere: r.matiere,
                matiereAr: r.matiereAr,
                ppr: r.ppr || null,
                firstNameAr: r.firstNameAr || null,
                lastNameAr: r.lastNameAr || null,
                phone: r.phone || null,
                ...(etabId ? { etablissementId: etabId } : {}),
              },
            });
            updated++;
          } else {
            skipped++;
            errors.push(`Ligne ${r.index + 1}: l'email ${r.email} est déjà utilisé par un autre compte`);
          }
        } else {
          const finalEmail = r.emailGenerated
            ? await findFreeEmail(r.email)
            : r.email;
          const newUser = await db.user.create({
            data: {
              email: finalEmail,
              name: `${r.firstName} ${r.lastName}`.trim(),
              password: r.password,
              role: "ENSEIGNANT",
              ...(etabId ? { etablissementId: etabId } : {}),
            },
          });
          await db.teacher.create({
            data: {
              userId: newUser.id,
              firstName: r.firstName,
              lastName: r.lastName,
              matiere: r.matiere,
              matiereAr: r.matiereAr,
              ppr: r.ppr || null,
              firstNameAr: r.firstNameAr || null,
              lastNameAr: r.lastNameAr || null,
              phone: r.phone || null,
              ...(etabId ? { etablissementId: etabId } : {}),
            },
          });
          created++;
        }
      } catch (e) {
        skipped++;
        errors.push(`Erreur ligne ${r.index + 1} (${r.firstName} ${r.lastName}): ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors: errors.slice(0, 20),
      totalRows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur lors de l'import: " + (e as Error).message }, { status: 500 });
  }
}
