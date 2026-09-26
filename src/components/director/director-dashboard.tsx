"use client";

// Espace Directeur — interface dédiée au chef d'établissement.
// Contrairement au tableau de bord du Surveillant, le Directeur dispose
// de sa propre navigation centrée sur la gestion des comptes de l'établissement.

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { AppShell, type SessionUser, type NavItem } from "@/components/app-shell";
import { LayoutDashboard, UserCog } from "lucide-react";
import { DirectorOverview } from "@/components/director/director-overview";
import { DirectorAccounts } from "@/components/director/director-accounts";

export function DirectorDashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { t } = useI18n();
  const [active, setActive] = useState("overview");

  const navItems: NavItem[] = [
    { id: "overview", label: t.directorOverview, icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "accounts", label: t.accounts, icon: <UserCog className="h-4 w-4" /> },
  ];

  return (
    <AppShell user={user} navItems={navItems} activeId={active} onNavigate={setActive} onLogout={onLogout}>
      {active === "overview" && <DirectorOverview />}
      {active === "accounts" && <DirectorAccounts />}
    </AppShell>
  );
}
