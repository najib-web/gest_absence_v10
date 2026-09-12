"use client";

// Bannière d'installation PWA :
//  - Android / Chrome : capte beforeinstallprompt et déclenche prompt() natif
//  - iOS Safari : affiche les étapes « Sur l'écran d'accueil »
//  - Masquable (« Plus tard »), disparaît une fois installée

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Share2, Smartphone, X, SquarePlus } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_TTL_MS = 3 * 24 * 60 * 60 * 1000; // re-proposer après 3 jours

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && "ontouchend" in document);
}

export function InstallPrompt() {
  const { t } = useI18n();
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    function recentlyDismissed(): boolean {
      try {
        const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
        return at > 0 && Date.now() - at < DISMISS_TTL_MS;
      } catch {
        return false;
      }
    }

    function check() {
      if (isStandalone()) return; // déjà installée
      if (recentlyDismissed()) return;
      // Pas d'événement natif (ex. iOS) mais appareil éligible → instructions
      if (!deferredRef.current && isIos()) {
        setIsIosDevice(true);
        setVisible(true);
      }
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      if (!recentlyDismissed()) {
        setIsIosDevice(false);
        setVisible(true);
      }
    }

    function onInstalled() {
      deferredRef.current = null;
      setVisible(false);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {}
      toast.success(t.installed);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const id = setTimeout(check, 2500); // laisse le temps à l'événement natif d'arriver

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(id);
    };
  }, [t.installed]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }, []);

  async function install() {
    const evt = deferredRef.current;
    if (!evt) {
      if (isIos()) setIosHelp(true);
      return;
    }
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      // l'utilisateur a fermé la bulle native
      setVisible(false);
    } finally {
      deferredRef.current = null;
    }
  }

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 pointer-events-none" role="dialog" aria-label={t.installApp}>
        <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border bg-background/95 backdrop-blur shadow-xl p-4 flex items-start gap-3">
          { }
          <img
            src="/icons/icon-192.png"
            alt=""
            className="w-12 h-12 rounded-xl border shadow-sm shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight">{t.installApp}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">{t.installAppDesc}</div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-8 px-4" onClick={install}>
                {isIosDevice ? (
                  <>
                    <SquarePlus className="h-4 w-4 me-1.5" />
                    {t.howToInstall}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 me-1.5" />
                    {t.install}
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3" onClick={dismiss}>
                {t.later}
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={dismiss}
            aria-label={t.close}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Instructions iOS */}
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              {t.iosInstallTitle}
            </DialogTitle>
            <DialogDescription>{t.installApp}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Share2 className="h-4 w-4" />
              </span>
              <span>{t.iosInstallStep1}</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <SquarePlus className="h-4 w-4" />
              </span>
              <span>{t.iosInstallStep2}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setIosHelp(false); dismiss(); }}>{t.ok}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
