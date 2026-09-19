// Détection des séances dont l'appel n'a pas été fait.
//
// Une « séance » attendue découle de la grille horaire hebdomadaire
// (ServiceSlot : jour + créneau + enseignant + classe + matière).
// L'appel est considéré fait lorsqu'une séance du jour correspondant
// (même enseignant + classe + groupe + matière) a attendanceDone = true
// (positionné par POST /api/absences).
//
// Tous les calculs se font côté client avec l'horloge locale du navigateur
// (cohérent avec findCurrentSlot / useNow) — aucun problème de fuseau.

import { getSchoolDayOfWeek, getMinutesOfDay } from "@/lib/schedule";

export const ATTENDANCE_GRACE_MIN = 5; // rappel 5 min après le début de la séance

export interface SlotLikeAlert {
  id: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  teacherId: string;
  classeId: string;
  groupId: string | null;
  subject: string;
  subjectAr?: string | null;
  teacher?: { user?: { name?: string | null }; firstName?: string; lastName?: string } | null;
  classe?: { code: string } | null;
  groupe?: { code: string } | null;
}

export interface SessionLikeAlert {
  id: string;
  date: string | Date;
  teacherId: string;
  classeId: string;
  groupId: string | null;
  subject: string;
  attendanceDone: boolean;
}

export interface MissedCall {
  /** Clé stable de l'occurrence (slot + jour) pour la déduplication des toasts */
  key: string;
  slotId: string;
  teacherId: string;
  teacherName: string;
  classeCode: string;
  groupeCode: string | null;
  subject: string;
  subjectAr: string | null;
  startMin: number;
  endMin: number;
  /** Minutes écoulées depuis le début théorique + grâce */
  minutesLate: number;
  /** Séance ouverte aujourd'hui mais appel non enregistré (peut être null) */
  sessionId: string | null;
  /** true si l'enseignant a encore « le temps » (créneau pas encore terminé) */
  slotOngoing: boolean;
}

/** Clé de rapprochement slot ↔ séance (identique aux critères de dédoublonnage de /api/sessions) */
function matchKey(teacherId: string, classeId: string, groupId: string | null, subject: string) {
  return `${teacherId}|${classeId}|${groupId || ""}|${subject}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function teacherDisplayName(slot: SlotLikeAlert): string {
  const t = slot.teacher;
  if (!t) return "";
  return t.user?.name || [t.lastName, t.firstName].filter(Boolean).join(" ") || "";
}

/**
 * Calcule les appels non faits pour un jour donné.
 * - slots : grille (tous les enseignants pour le surveillant, un seul pour l'enseignant)
 * - sessions : séances du jour (ou plus) — filtrées ici sur aujourd'hui
 * - now : horloge locale du client
 */
export function computeMissedCalls(
  slots: SlotLikeAlert[],
  sessions: SessionLikeAlert[],
  now: Date,
  graceMin: number = ATTENDANCE_GRACE_MIN
): MissedCall[] {
  const dow = getSchoolDayOfWeek(now);
  if (dow === null) return []; // dimanche : pas de classe

  const minutes = getMinutesOfDay(now);

  // Séances d'aujourd'hui uniquement
  const todaySessions = sessions.filter((s) => sameDay(new Date(s.date), now));

  // Appels déjà faits aujourd'hui (clé = enseignant|classe|groupe|matière)
  const done = new Set<string>();
  // Séances ouvertes sans appel enregistré (pour l'info sessionId)
  const openedNoCall = new Map<string, string>();
  for (const s of todaySessions) {
    const k = matchKey(s.teacherId, s.classeId, s.groupId ?? null, s.subject);
    if (s.attendanceDone) {
      done.add(k);
    } else {
      openedNoCall.set(k, s.id);
    }
  }

  const missed: MissedCall[] = [];
  for (const slot of slots) {
    if (slot.dayOfWeek !== dow) continue;
    // Trop tôt : la séance n'a pas 5 minutes
    if (minutes < slot.startMin + graceMin) continue;
    const k = matchKey(slot.teacherId, slot.classeId, slot.groupId ?? null, slot.subject);
    if (done.has(k)) continue;
    missed.push({
      key: `${slot.id}|${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
      slotId: slot.id,
      teacherId: slot.teacherId,
      teacherName: teacherDisplayName(slot),
      classeCode: slot.classe?.code ?? "",
      groupeCode: slot.groupe?.code ?? null,
      subject: slot.subject,
      subjectAr: slot.subjectAr ?? null,
      startMin: slot.startMin,
      endMin: slot.endMin,
      minutesLate: minutes - (slot.startMin + graceMin),
      sessionId: openedNoCall.get(k) ?? null,
      slotOngoing: minutes < slot.endMin,
    });
  }

  missed.sort((a, b) => a.startMin - b.startMin || a.classeCode.localeCompare(b.classeCode));
  return missed;
}
