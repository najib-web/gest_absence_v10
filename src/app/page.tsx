"use client";

import { useEffect, useState } from "react";
import { Providers } from "@/components/providers";
import { LoginView } from "@/components/login-view";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { TeacherDashboard } from "@/components/teacher/teacher-dashboard";
import { Loader2, GraduationCap } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "DIRECTEUR" | "SURVEILLANT" | "ENSEIGNANT";
  teacherId?: string;
}

function PageContent() {
  const { t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setUser(data.user || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
          <GraduationCap className="h-7 w-7" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">{t.loading}</div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoggedIn={(u) => setUser(u)} />;
  }

  if (user.role === "ENSEIGNANT") {
    return <TeacherDashboard user={user} onLogout={() => setUser(null)} />;
  }

  return <AdminDashboard user={user} onLogout={() => setUser(null)} />;
}

export default function Home() {
  return (
    <Providers>
      <PwaRegister />
      <InstallPrompt />
      <PageContent />
    </Providers>
  );
}
