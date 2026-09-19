"use client";

// Surveille la grille horaire + les séances du jour et expose la liste des
// appels non faits (rappel enseignant / notification surveillant).
// Rafraîchit les données toutes les 45 s et recalcule toutes les 30 s
// avec l'horloge locale du navigateur (cohérent avec findCurrentSlot).
//
// Suppression des notifications :
// - automatique dès que l'appel est enregistré (Session.attendanceDone) ;
// - manuelle par le surveillant/directeur (AttendanceDismissal, filtrées ici).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeMissedCalls,
  type MissedCall,
  type SessionLikeAlert,
  type SlotLikeAlert,
} from "@/lib/attendance-alerts";
import { localDateKey } from "@/lib/schedule";

interface Options {
  /** teacherId pour l'enseignant (filtre sa grille) — undefined pour le staff */
  teacherId?: string | null;
  /** Activer la surveillance (par ex. seulement pour les bons rôles) */
  enabled: boolean;
  /** Appelé une seule fois par séance restée sans appel (nouvelle alerte) */
  onNewAlert?: (alert: MissedCall) => void;
}

export function useAttendanceMonitor({ teacherId, enabled, onNewAlert }: Options) {
  const [slots, setSlots] = useState<SlotLikeAlert[]>([]);
  const [sessions, setSessions] = useState<SessionLikeAlert[]>([]);
  // Clés "slotId|YYYY-MM-DD" des notifications supprimées manuellement (staff)
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const alertCbRef = useRef(onNewAlert);

  useEffect(() => {
    alertCbRef.current = onNewAlert;
  }, [onNewAlert]);

  // Horloge locale — recalcule les alertes toutes les 30 s
  useEffect(() => {
    if (!enabled) return;
    const t0 = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(timer);
    };
  }, [enabled]);

  // Chargement des données (grille + séances du jour + suppressions manuelles),
  // re-poll toutes les 45 s
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const slotsUrl = teacherId
        ? `/api/service-slots?teacherId=${encodeURIComponent(teacherId)}`
        : "/api/service-slots";
      const sessionsUrl = `/api/sessions?from=${todayStart.toISOString()}${
        teacherId ? `&teacherId=${encodeURIComponent(teacherId)}` : ""
      }`;
      try {
        const [slotsRes, sessionsRes, dismissalsRes] = await Promise.all([
          fetch(slotsUrl).then((r) => (r.ok ? r.json() : { slots: [] })),
          fetch(sessionsUrl).then((r) => (r.ok ? r.json() : { sessions: [] })),
          fetch("/api/attendance/dismissals")
            .then((r) => (r.ok ? r.json() : { dismissals: [] }))
            .catch(() => ({ dismissals: [] })),
        ]);
        if (!cancelled) {
          setSlots(slotsRes.slots ?? []);
          setSessions(sessionsRes.sessions ?? []);
          setDismissedKeys(
            new Set(
              (dismissalsRes.dismissals ?? []).map(
                (d: { slotId: string; dateKey: string }) => `${d.slotId}|${d.dateKey}`
              )
            )
          );
        }
      } catch {
        // Réseau indisponible (offline) — on conserve les données précédentes
      }
    }

    load();
    const timer = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [teacherId, enabled]);

  const missed: MissedCall[] = useMemo(() => {
    if (!enabled || !now) return [];
    return computeMissedCalls(slots, sessions, now).filter(
      (m) => !dismissedKeys.has(m.key)
    );
  }, [enabled, now, slots, sessions, dismissedKeys]);

  // Notifications : une seule alerte par occurrence de séance (clé stable)
  useEffect(() => {
    if (!enabled || missed.length === 0) return;
    for (const m of missed) {
      if (seenRef.current.has(m.key)) continue;
      seenRef.current.add(m.key);
      alertCbRef.current?.(m);
    }
  }, [missed, enabled]);

  /**
   * Suppression manuelle de la notification d'une occurrence de séance
   * (surveillant/directeur) — retire immédiatement l'alerte de la liste.
   */
  const dismiss = useCallback(async (m: Pick<MissedCall, "slotId" | "key">) => {
    const dateKey = m.key.split("|")[1] || localDateKey(new Date());
    const res = await fetch("/api/attendance/dismissals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: m.slotId, dateKey }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Erreur de suppression");
    }
    setDismissedKeys((prev) => new Set(prev).add(m.key));
  }, []);

  return { missed, dismiss };
}
