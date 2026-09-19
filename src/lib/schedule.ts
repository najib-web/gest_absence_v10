// Shared weekly schedule logic: days Lundi→Samedi, time slots 8h→18h,
// current-session detection based on system date/time.

export interface TimeSlotDef {
  id: number;
  startMin: number; // minutes since midnight
  endMin: number;
}

// 5 créneaux de 2h couvrant exactement 08:00 → 18:00
export const TIME_SLOTS: TimeSlotDef[] = [
  { id: 1, startMin: 8 * 60, endMin: 10 * 60 },  // 08:00 - 10:00
  { id: 2, startMin: 10 * 60, endMin: 12 * 60 }, // 10:00 - 12:00
  { id: 3, startMin: 12 * 60, endMin: 14 * 60 }, // 12:00 - 14:00
  { id: 4, startMin: 14 * 60, endMin: 16 * 60 }, // 14:00 - 16:00
  { id: 5, startMin: 16 * 60, endMin: 18 * 60 }, // 16:00 - 18:00
];

// Plage scolaire et durées de séance autorisées (1h ou 2h)
export const SCHOOL_START_MIN = 8 * 60; // 08:00
export const SCHOOL_END_MIN = 18 * 60;  // 18:00
export const SLOT_DURATIONS_H = [1, 2]; // durées possibles en heures

// 10 lignes horaires de 08:00 à 18:00 (base de la grille)
export const HOUR_SLOTS: TimeSlotDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  startMin: SCHOOL_START_MIN + i * 60,
  endMin: SCHOOL_START_MIN + (i + 1) * 60,
}));

/**
 * Vérifie qu'un créneau est valide :
 * aligné sur l'heure, durée de 1h ou 2h, à l'intérieur de 08:00 → 18:00.
 */
export function isValidTimeSlot(startMin: number, endMin: number): boolean {
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) return false;
  if (startMin < SCHOOL_START_MIN || endMin > SCHOOL_END_MIN) return false;
  const dur = endMin - startMin;
  if (dur <= 0) return false;
  if (!SLOT_DURATIONS_H.includes(dur / 60)) return false;
  return startMin % 60 === 0;
}

/** Durée d'un créneau en heures (ex: 1 ou 2) */
export function slotDurationHours(startMin: number, endMin: number): number {
  return (endMin - startMin) / 60;
}

/** Toutes les combinaisons valides (début × durée) pour l'aide à la saisie */
export function buildSlotOptions(): { startMin: number; endMin: number; hours: number }[] {
  const out: { startMin: number; endMin: number; hours: number }[] = [];
  for (let h = SCHOOL_START_MIN / 60; h < SCHOOL_END_MIN / 60; h++) {
    for (const dur of SLOT_DURATIONS_H) {
      const end = (h + dur) * 60;
      if (end <= SCHOOL_END_MIN) {
        out.push({ startMin: h * 60, endMin: end, hours: dur });
      }
    }
  }
  return out;
}

export const DAY_NAMES: { dow: number; fr: string; ar: string; frShort: string; arShort: string }[] = [
  { dow: 1, fr: "Lundi", ar: "الاثنين", frShort: "Lun", arShort: "الإثنين" },
  { dow: 2, fr: "Mardi", ar: "الثلاثاء", frShort: "Mar", arShort: "الثلاثاء" },
  { dow: 3, fr: "Mercredi", ar: "الأربعاء", frShort: "Mer", arShort: "الأربعاء" },
  { dow: 4, fr: "Jeudi", ar: "الخميس", frShort: "Jeu", arShort: "الخميس" },
  { dow: 5, fr: "Vendredi", ar: "الجمعة", frShort: "Ven", arShort: "الجمعة" },
  { dow: 6, fr: "Samedi", ar: "السبت", frShort: "Sam", arShort: "السبت" },
];

/** Convert minutes since midnight → "HH:MM" */
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Label of a slot range, e.g. "08:00 - 10:00" */
export function slotRangeLabel(startMin: number, endMin: number): string {
  return `${minutesToLabel(startMin)} - ${minutesToLabel(endMin)}`;
}

/**
 * Day of week in school terms: 1 = Lundi ... 6 = Samedi.
 * Returns null on Sunday (0) — non school day.
 */
export function getSchoolDayOfWeek(d: Date = new Date()): number | null {
  const js = d.getDay(); // 0 = Sunday ... 6 = Saturday
  if (js === 0) return null;
  return js;
}

/** Minutes since midnight for a given date */
export function getMinutesOfDay(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Clé locale du jour au format "YYYY-MM-DD" (padding complet).
 * Sert d'identifiant stable pour les occurrences de séance
 * (suppression manuelle des notifications d'appel non fait).
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Date d'une séance formatée selon la locale, ex :
 * FR « samedi 20 septembre 2026 » — AR « السبت 20 سبتمبر 2026 ».
 */
export function formatSeanceDate(d: Date = new Date(), locale: string = "fr"): string {
  return d.toLocaleDateString(locale === "ar" ? "ar-MA" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Date de séance compacte (badges, listes), ex :
 * FR « sam. 20 sept. » — AR « السبت 20 سبتمبر ».
 */
export function formatSeanceDateShort(d: Date = new Date(), locale: string = "fr"): string {
  return d.toLocaleDateString(locale === "ar" ? "ar-MA" : "fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export interface SlotLike {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

/** Find the slot currently in progress (day matches + startMin <= now < endMin) */
export function findCurrentSlot<T extends SlotLike>(slots: T[], now: Date = new Date()): T | null {
  const dow = getSchoolDayOfWeek(now);
  if (dow === null) return null;
  const minutes = getMinutesOfDay(now);
  return (
    slots.find(
      (s) => s.dayOfWeek === dow && s.startMin <= minutes && minutes < s.endMin
    ) ?? null
  );
}

/**
 * Find the next upcoming slot occurrence starting from `now`
 * (later today, or the next school days within the following week).
 * Returns the slot plus how many days ahead it is (0 = today).
 */
export function findNextSlot<T extends SlotLike>(
  slots: T[],
  now: Date = new Date()
): { slot: T; daysAhead: number } | null {
  if (slots.length === 0) return null;
  const minutes = getMinutesOfDay(now);
  const jsDow = now.getDay(); // 0=Sun..6=Sat

  // Candidate school days ordered from today: today (if not Sunday), then following days, wrap a full week
  for (let ahead = 0; ahead <= 7; ahead++) {
    const js = (jsDow + ahead) % 7;
    if (js === 0) continue; // skip Sunday
    const candidateSlots = slots.filter((s) => s.dayOfWeek === js);
    if (candidateSlots.length === 0) continue;
    // Sort by start time
    candidateSlots.sort((a, b) => a.startMin - b.startMin);
    if (ahead === 0) {
      const next = candidateSlots.find((s) => s.startMin > minutes);
      if (next) return { slot: next, daysAhead: 0 };
    } else {
      return { slot: candidateSlots[0], daysAhead: ahead };
    }
  }
  return null;
}

export interface SlotWithPeople extends SlotLike {
  id: string;
  teacherId?: string;
  teacher?: { firstName: string; lastName: string } | null;
  classe?: { code: string } | null;
  groupe?: { code: string } | null;
  subject?: string | null;
  subjectAr?: string | null;
}
