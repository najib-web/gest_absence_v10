"use client";

import { ReactNode, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "DIRECTEUR" | "SURVEILLANT" | "ENSEIGNANT";
  teacherId?: string;
}

export function AppShell({
  user,
  navItems,
  activeId,
  onNavigate,
  onLogout,
  children,
}: {
  user: SessionUser;
  navItems: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success(t.logout);
    onLogout();
  }

  const roleLabel =
    user.role === "DIRECTEUR"
      ? t.directeur
      : user.role === "SURVEILLANT"
        ? t.surveillant
        : t.enseignant;
  const roleIcon = user.role === "DIRECTEUR" ? "🎓" : user.role === "SURVEILLANT" ? "🛡️" : "📚";

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Top bar */}
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-sm leading-tight">{t.appName}</div>
                <div className="text-xs text-muted-foreground leading-tight">
                  {user.role === "ENSEIGNANT" ? t.teacherDashboard : t.adminDashboard}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-muted">
              <span>{roleIcon}</span>
              <div className="text-xs">
                <div className="font-medium leading-tight">{user.name}</div>
                <div className="text-muted-foreground leading-tight">{roleLabel}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title={t.logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex w-60 flex-col border-e bg-background">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={item.id === activeId}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </nav>
          <div className="p-3 border-t">
            <div className="text-xs text-muted-foreground px-2">
              {user.email}
            </div>
          </div>
        </aside>

        {/* Sidebar (mobile drawer) */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="absolute top-0 start-0 h-full w-72 bg-background shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <span className="font-bold">{t.appName}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={item.id === activeId}
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                  />
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </button>
  );
}
