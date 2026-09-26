"use client";

import { Smartphone, WifiOff } from "lucide-react";

// Page hors ligne — servie par le service worker quand le réseau est indisponible.
// Bilingue FR/AR (affiché en dur, le provider i18n n'englobe que la route "/").
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-4">
      <div className="max-w-sm w-full text-center space-y-5 rounded-2xl border border-emerald-100 bg-white/90 shadow-lg p-8">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-16 w-16 rounded-2xl mx-auto shadow-sm"
        />
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-lg font-bold">
            <WifiOff className="h-5 w-5 text-destructive" />
            Vous êtes hors ligne
          </div>
          <p className="text-sm text-muted-foreground">
            Vérifiez votre connexion internet, puis réessayez.
          </p>
        </div>
        <div className="pt-1 space-y-2" dir="rtl" lang="ar">
          <div className="text-base font-bold">أنت غير متصل بالإنترنت</div>
          <p className="text-sm text-muted-foreground">
            تحقّق من اتصالك بالإنترنت ثم أعد المحاولة.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Smartphone className="h-4 w-4" />
          Réessayer · <span dir="rtl" lang="ar">إعادة المحاولة</span>
        </button>
      </div>
    </div>
  );
}
