"use client";

// Notification sonore (Web Audio API) — aucun fichier audio requis,
// fonctionne hors-ligne (PWA). Utilisée pour le rappel d'appel enseignant.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    // Politique d'autoplay : tente de reprendre le contexte (no-op s'il est actif)
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Petite cloche double (ding-dong) jouée `repeat` fois. */
export function playReminderBeep(repeat: number = 2) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + 0.08;
    const ding = 880; // La5
    const dong = 660; // Mi5
    for (let r = 0; r < repeat; r++) {
      const base = t0 + r * 0.9;
      tone(ctx, ding, base, 0.22, 0.14);
      tone(ctx, dong, base + 0.3, 0.32, 0.12);
    }
  } catch {
    // Autoplay bloqué ou matériel indisponible : silencieux
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  at: number,
  duration: number,
  peak: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Envelope douce (attack 15 ms, release) pour éviter les clics
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}
