"use client";

// Surveille la grille horaire + les séances du jour et expose la liste des
// appels non faits (rappel enseignant / notification surveillant).
// Rafraîchit les données toutes les 45 s et recalcule toutes les 30 s
// avec l'horloge locale du navigateur (cohérent avec findCurrentSlot).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeMissedCalls,
  type MissedCall,
  type SessionLikeAlert,
  type SlotLikeAlert,
} from "@/lib/attendance-alerts";

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

  // Chargement des données (grille + séances du jour), re-poll toutes les 45 s
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
        const [slotsRes, sessionsRes] = await Promise.all([
          fetch(slotsUrl).then((r) => (r.ok ? r.json() : { slots: [] })),
          fetch(sessionsUrl).then((r) => (r.ok ? r.json() : { sessions: [] })),
        ]);
        if (!cancelled) {
          setSlots(slotsRes.slots ?? []);
          setSessions(sessionsRes.sessions ?? []);
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

  const missed: MissedCall[] = useMemo(
    () => (enabled && now ? computeMissedCalls(slots, sessions, now) : []),
    [enabled, now, slots, sessions]
  );

  // Notifications : une seule alerte par occurrence de séance (clé stable)
  useEffect(() => {
    if (!enabled || missed.length === 0) return;
    for (const m of missed) {
      if (seenRef.current.has(m.key)) continue;
      seenRef.current.add(m.key);
      alertCbRef.current?.(m);
    }
  }, [missed, enabled]);

  return { missed };
}
