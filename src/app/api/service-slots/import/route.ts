import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { parseServiceFile, deaccent } from "@/lib/excel";
import { isValidTimeSlot, DAY_NAMES, minutesToLabel } from "@/lib/schedule";
import { subjectArFromFr } from "@/lib/subjects";

interface Interval {
  start: number;
  end: number;
  id: string; // slot id or "new-<rowIndex>"
}

function addInterval(
  busy: Map<string, Map<number, Interval[]>>,
  key: string,
  day: number,
  start: number,
  end: number,
  id: string
) {
  if (!busy.has(key)) busy.set(key, new Map());
  const days = busy.get(key)!;
  if (!days.has(day)) days.set(day, []);
  days.get(day)!.push({ start, end, id });
}

function removeIntervalById(
  busy: Map<string, Map<number, Interval[]>>,
  key: string,
  day: number,
  id: string
) {
  const days = busy.get(key);
  if (!days) return;
  const list = days.get(day);
  if (!list) return;
  const idx = list.findIndex((iv) => iv.id === id);
  if (idx >= 0) list.splice(idx, 1);
}

function findOverlap(list: Interval[] | undefined, start: number, end: number): boolean {
  if (!list) return false;
  return list.some((iv) => start < iv.end && end > iv.start);
}

// Step 1: upload + parse + resolve + conflict detection (preview mode writes nothing)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "preview";

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { rows, detectedHeaders, totalRows } = parseServiceFile(buffer);

    if (totalRows === 0) {
      return NextResponse.json({
        error:
          "Aucune séance trouvée dans le fichier. Vérifiez le format (colonnes: Jour, Heure début, Heure fin, Classe, Enseignant, Matière).",
        detectedHeaders,
      }, { status: 400 });
    }

    // Load reference data
    const teachers = await db.teacher.findMany();
    const classes = await db.classe.findMany({ include: { groups: true } });
    const dbSlots = await db.serviceSlot.findMany();

    // Name resolution maps (accent/case-insensitive), both "Nom Prénom" and "Prénom Nom"
    const teacherByKey = new Map<string, (typeof teachers)[number]>();
    for (const t of teachers) {
      const keys = new Set([
        `${deaccent(t.lastName)} ${deaccent(t.firstName)}`,
        `${deaccent(t.firstName)} ${deaccent(t.lastName)}`,
        `${deaccent(t.lastName)}${deaccent(t.firstName)}`,
        `${deaccent(t.firstName)}${deaccent(t.lastName)}`,
      ]);
      for (const k of keys) if (!teacherByKey.has(k)) teacherByKey.set(k, t);
    }

    const classeByCode = new Map<string, (typeof classes)[number]>();
    for (const c of classes) {
      classeByCode.set(deaccent(c.code), c);
      classeByCode.set(deaccent(c.code).replace(/\s/g, ""), c);
    }

    // Occupancy maps initialized from the current DB state
    const teacherBusy = new Map<string, Map<number, Interval[]>>();
    const classBusy = new Map<string, Map<number, Interval[]>>();
    const slotByTeacherDayStart = new Map<string, string>(); // `${teacherId}|${day}|${startMin}` → slot id
    for (const s of dbSlots) {
      addInterval(teacherBusy, s.teacherId, s.dayOfWeek, s.startMin, s.endMin, s.id);
      const cKey = s.classeId + (s.groupId ? ":" + s.groupId : "");
      addInterval(classBusy, cKey, s.dayOfWeek, s.startMin, s.endMin, s.id);
      slotByTeacherDayStart.set(`${s.teacherId}|${s.dayOfWeek}|${s.startMin}`, s.id);
    }

    const enriched = rows.map((r, index) => {
      const base = {
        index,
        dayRaw: r.dayRaw,
        day: r.day,
        dayLabel: r.day && r.day >= 1 && r.day <= 6 ? DAY_NAMES[r.day - 1].fr : r.dayRaw || "—",
        startMin: r.startMin,
        endMin: r.endMin,
        timeLabel:
          r.startMin !== null && r.endMin !== null
            ? `${minutesToLabel(r.startMin)} - ${minutesToLabel(r.endMin)}`
            : `${r.startMin !== null ? minutesToLabel(r.startMin) : "?"} - ${r.endMin !== null ? minutesToLabel(r.endMin) : "?"}`,
        classeCode: r.classeCode,
        groupeCode: r.groupeCode,
        teacherName: r.teacherName,
        matiereInput: r.matiere,
      };

      // --- Resolutions ---
      const teacher = teacherByKey.get(deaccent(r.teacherName).replace(/\s+/g, " "));
      const classe = classeByCode.get(deaccent(r.classeCode).replace(/\s/g, ""));
      const groupe = classe && r.groupeCode
        ? classe.groups.find((g: { code: string }) => deaccent(g.code).replace(/\s/g, "") === deaccent(r.groupeCode).replace(/\s/g, "")) || null
        : null;
      // Subject: from the file, or fallback to the teacher's own subject
      const matiere = r.matiere || teacher?.matiere || "";
      const matiereAr = subjectArFromFr(matiere) || (teacher?.matiereAr ?? null);

      let status: "create" | "update" | "error" = "create";
      let errorCode: string | undefined;

      // --- Validations ---
      if (!r.teacherName && !r.classeCode) errorCode = "MISSING_FIELD";
      else if (r.day === null) errorCode = "INVALID_DAY";
      else if (r.startMin === null || r.endMin === null) errorCode = "INVALID_TIME";
      else if (!isValidTimeSlot(r.startMin, r.endMin)) errorCode = "INVALID_SLOT";
      else if (!teacher) errorCode = "TEACHER_NOT_FOUND";
      else if (!classe) errorCode = "CLASSE_NOT_FOUND";
      else if (r.groupeCode && !groupe) errorCode = "GROUPE_NOT_FOUND";

      if (errorCode) {
        status = "error";
        return {
          ...base,
          teacherId: teacher?.id ?? null,
          teacherResolved: teacher ? `${teacher.lastName} ${teacher.firstName}` : null,
          classeId: classe?.id ?? null,
          groupeId: groupe?.id ?? null,
          matiere,
          matiereAr,
          status,
          errorCode,
        };
      }

      const tId = teacher!.id;
      const cId = classe!.id;
      const gId = groupe?.id ?? null;
      const start = r.startMin!;
      const end = r.endMin!;
      const day = r.day!;

      // Replace semantics: same teacher + day + startMin → the existing slot is updated
      const existingId = slotByTeacherDayStart.get(`${tId}|${day}|${start}`);
      if (existingId) {
        removeIntervalById(teacherBusy, tId, day, existingId);
        const prevSlot = dbSlots.find((s) => s.id === existingId);
        if (prevSlot) {
          const prevCKey = prevSlot.classeId + (prevSlot.groupId ? ":" + prevSlot.groupId : "");
          removeIntervalById(classBusy, prevCKey, day, existingId);
        }
        status = "update";
      }

      // Conflict checks (against DB state + previously processed rows of this file)
      const tList = teacherBusy.get(tId)?.get(day);
      if (findOverlap(tList, start, end)) {
        // Restore the removed interval of the "update" case before flagging the error
        if (existingId) {
          const prevSlot = dbSlots.find((s) => s.id === existingId);
          if (prevSlot) {
            addInterval(teacherBusy, tId, day, prevSlot.startMin, prevSlot.endMin, existingId);
            const prevCKey = prevSlot.classeId + (prevSlot.groupId ? ":" + prevSlot.groupId : "");
            addInterval(classBusy, prevCKey, day, prevSlot.startMin, prevSlot.endMin, existingId);
          }
        }
        status = "error";
        return {
          ...base,
          teacherId: tId,
          teacherResolved: `${teacher!.lastName} ${teacher!.firstName}`,
          classeId: cId,
          groupeId: gId,
          matiere,
          matiereAr,
          status,
          errorCode: "TEACHER_CONFLICT",
        };
      }
      const cKey = cId + (gId ? ":" + gId : "");
      if (findOverlap(classBusy.get(cKey)?.get(day), start, end)) {
        if (existingId) {
          const prevSlot = dbSlots.find((s) => s.id === existingId);
          if (prevSlot) {
            addInterval(teacherBusy, tId, day, prevSlot.startMin, prevSlot.endMin, existingId);
            const prevCKey = prevSlot.classeId + (prevSlot.groupId ? ":" + prevSlot.groupId : "");
            addInterval(classBusy, prevCKey, day, prevSlot.startMin, prevSlot.endMin, existingId);
          }
        }
        status = "error";
        return {
          ...base,
          teacherId: tId,
          teacherResolved: `${teacher!.lastName} ${teacher!.firstName}`,
          classeId: cId,
          groupeId: gId,
          matiere,
          matiereAr,
          status,
          errorCode: "CLASS_CONFLICT",
        };
      }

      // Book the interval for subsequent rows of this file
      addInterval(teacherBusy, tId, day, start, end, existingId ?? `new-${index}`);
      addInterval(classBusy, cKey, day, start, end, existingId ?? `new-${index}`);
      slotByTeacherDayStart.set(`${tId}|${day}|${start}`, existingId ?? `new-${index}`);

      return {
        ...base,
        teacherId: tId,
        teacherResolved: `${teacher!.lastName} ${teacher!.firstName}`,
        classeId: cId,
        classeLabel: classe!.code,
        groupeId: gId,
        matiere,
        matiereAr,
        status,
        errorCode: undefined,
      };
    });

    const summary = {
      toCreate: enriched.filter((r) => r.status === "create").length,
      toUpdate: enriched.filter((r) => r.status === "update").length,
      errors: enriched.filter((r) => r.status === "error").length,
    };

    if (mode === "preview") {
      return NextResponse.json({
        rows: enriched,
        detectedHeaders,
        totalRows,
        summary,
      });
    }

    // mode === "commit": write creates + updates, then sync service tables
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const affectedCombos = new Map<
      string,
      { teacherId: string; classeId: string; groupId: string | null; subject: string; subjectAr: string | null }
    >();

    for (const r of enriched) {
      if (r.status === "error" || !r.teacherId || !r.classeId) {
        skipped++;
        errors.push(
          `Ligne ${r.index + 1} (${r.dayLabel} ${r.timeLabel}, ${r.classeCode} — ${r.teacherName}) : ignorée`
        );
        continue;
      }
      try {
        const groupId = r.groupeId ?? null;
        const data = {
          teacherId: r.teacherId,
          dayOfWeek: r.day as number,
          startMin: r.startMin as number,
          endMin: r.endMin as number,
          classeId: r.classeId,
          groupId,
          subject: r.matiere,
          subjectAr: r.matiereAr,
        };
        const existingId = slotByTeacherDayStart.get(`${r.teacherId}|${r.day}|${r.startMin}`);
        if (existingId && !existingId.startsWith("new-")) {
          await db.serviceSlot.update({ where: { id: existingId }, data });
          updated++;
        } else {
          await db.serviceSlot.create({ data });
          created++;
        }
        affectedCombos.set(
          `${r.teacherId}|${r.classeId}|${groupId ?? ""}|${r.matiere}`,
          { teacherId: r.teacherId, classeId: r.classeId, groupId, subject: r.matiere, subjectAr: r.matiereAr }
        );
      } catch (e) {
        skipped++;
        errors.push(`Erreur ligne ${r.index + 1}: ${(e as Error).message}`);
      }
    }

    // Keep the "Tables de Service" (teacher ↔ classe ↔ matière assignments) in sync
    let serviceTablesUpdated = 0;
    for (const combo of affectedCombos.values()) {
      const slots = await db.serviceSlot.findMany({
        where: {
          teacherId: combo.teacherId,
          classeId: combo.classeId,
          ...(combo.groupId ? { groupId: combo.groupId } : { groupId: null }),
          subject: combo.subject,
        },
      });
      const hours = slots.reduce((acc, s) => acc + (s.endMin - s.startMin) / 60, 0);
      const hoursPerWeek = Math.max(1, Math.round(hours));
      // Compound unique contains a nullable column → findFirst + create/update
      const existingService = await db.serviceTable.findFirst({
        where: {
          teacherId: combo.teacherId,
          classeId: combo.classeId,
          ...(combo.groupId ? { groupId: combo.groupId } : { groupId: null }),
          subject: combo.subject,
        },
        select: { id: true },
      });
      if (existingService) {
        await db.serviceTable.update({
          where: { id: existingService.id },
          data: { hoursPerWeek, subjectAr: combo.subjectAr },
        });
      } else {
        await db.serviceTable.create({
          data: {
            teacherId: combo.teacherId,
            classeId: combo.classeId,
            groupId: combo.groupId,
            subject: combo.subject,
            subjectAr: combo.subjectAr,
            hoursPerWeek,
          },
        });
      }
      serviceTablesUpdated++;
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      serviceTablesUpdated,
      errors: errors.slice(0, 20),
      totalRows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur lors de l'import: " + (e as Error).message }, { status: 500 });
  }
}
