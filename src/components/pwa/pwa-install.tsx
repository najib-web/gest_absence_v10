"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  MonitorSmartphone,
  PlusSquare,
  Share,
  SquarePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

function isIOSDevice() {
  const ua = window.navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && "ontouchend" in document)
  );
}

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Bannière + invite d'installation PWA.
// Android/Chrome : invite native via beforeinstallprompt.
// iOS/Safari : guide « Partager → Sur l'écran d'accueil ».
// La bannière peut être fermée (mémorisé 7 jours) ; événement personnalisé
// « pwa-install-request » déclenché par le bouton de la page de connexion.
export function PwaInstall() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    const standaloneNow = isStandaloneDisplay();
    setStandalone(standaloneNow);
    if (standaloneNow) return;
    setIsIOS(isIOSDevice());

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const dismissed =
      dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        timers.push(setTimeout(() => setShowBanner(true), 2500));
      }
    };

    const onInstalled = () => {
      setDeferred(null);
      setShowBanner(false);
      localStorage.removeItem(DISMISS_KEY);
      toast.success(t.installedToast);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari : pas d'événement beforeinstallprompt → proposer le guide
    if (isIOSDevice() && !dismissed) {
      timers.push(setTimeout(() => setShowBanner(true), 4000));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      timers.forEach(clearTimeout);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    setShowBanner(false);
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } finally {
        setDeferred(null);
      }
      return;
    }
    // Pas d'invite native (iOS Safari ou critères non réunis) → guide
    setGuideOpen(true);
  }, [deferred]);

  useEffect(() => {
    const onRequest = () => {
      if (isStandaloneDisplay()) return;
      void requestInstall();
    };
    window.addEventListener("pwa-install-request", onRequest);
    return () => window.removeEventListener("pwa-install-request", onRequest);
  }, [requestInstall]);

  function dismiss() {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  if (standalone) return null;

  return (
    <>
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-md rounded-xl border border-emerald-100 bg-white/95 shadow-lg backdrop-blur p-3 flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt=""
              className="h-11 w-11 rounded-xl shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">
                {t.appName}
              </div>
              <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                {t.installBannerDesc}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" className="h-8 px-3" onClick={requestInstall}>
                <Download className="h-4 w-4" />
                {t.installShort}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={dismiss}
                aria-label={t.later}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5 text-primary" />
              {t.installApp}
            </DialogTitle>
            <DialogDescription>
              {isIOS ? t.iosInstallDesc : t.desktopInstallDesc}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            {isIOS ? (
              <>
                <GuideStep
                  n={1}
                  icon={<Share className="h-4 w-4 text-primary" />}
                  text={t.iosStep1}
                />
                <GuideStep
                  n={2}
                  icon={<PlusSquare className="h-4 w-4 text-primary" />}
                  text={t.iosStep2}
                />
                <GuideStep n={3} text={t.iosStep3} />
              </>
            ) : (
              <>
                <GuideStep
                  n={1}
                  icon={<MonitorSmartphone className="h-4 w-4 text-primary" />}
                  text={t.desktopStep1}
                />
                <GuideStep
                  n={2}
                  icon={<SquarePlus className="h-4 w-4 text-primary" />}
                  text={t.desktopStep2}
                />
              </>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GuideStep({
  n,
  icon,
  text,
}: {
  n: number;
  icon?: React.ReactNode;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span className="text-foreground/90">{text}</span>
    </li>
  );
}
