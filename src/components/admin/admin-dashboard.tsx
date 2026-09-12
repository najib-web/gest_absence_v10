"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { AppShell, type SessionUser, type NavItem } from "@/components/app-shell";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ShieldAlert,
  CalendarDays,
  UserCheck,
  History,
  UserCog,
} from "lucide-react";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminStudents } from "@/components/admin/admin-students";
import { AdminClasses } from "@/components/admin/admin-classes";
import { AdminTeachers } from "@/components/admin/admin-teachers";
import { AdminSchedule } from "@/components/admin/admin-schedule";
import { AdminSupervision } from "@/components/admin/admin-supervision";
import { AdminOrientations } from "@/components/admin/admin-orientations";
import { AdminAccounts } from "@/components/admin/admin-accounts";
import { AbsenceHistory } from "@/components/absence-history";

export function AdminDashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { t } = useI18n();
  const [active, setActive] = useState("overview");

  const navItems: NavItem[] = [
    { id: "overview", label: t.overview, icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "students", label: t.students, icon: <Users className="h-4 w-4" /> },
    { id: "classes", label: `${t.classes} & ${t.groups}`, icon: <GraduationCap className="h-4 w-4" /> },
    { id: "teachers", label: `${t.teachers} & ${t.serviceTables}`, icon: <BookOpen className="h-4 w-4" /> },
    { id: "schedule", label: t.weeklySchedule, icon: <CalendarDays className="h-4 w-4" /> },
    { id: "supervision", label: t.supervision, icon: <ShieldAlert className="h-4 w-4" /> },
    { id: "orientations", label: t.orientations, icon: <UserCheck className="h-4 w-4" /> },
    { id: "historique", label: t.absenceHistory, icon: <History className="h-4 w-4" /> },
    // Réservé au Directeur
    ...(user.role === "DIRECTEUR"
      ? [{ id: "comptes", label: t.accounts, icon: <UserCog className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <AppShell user={user} navItems={navItems} activeId={active} onNavigate={setActive} onLogout={onLogout}>
      {active === "overview" && <AdminOverview />}
      {active === "students" && <AdminStudents />}
      {active === "classes" && <AdminClasses />}
      {active === "teachers" && <AdminTeachers />}
      {active === "schedule" && <AdminSchedule />}
      {active === "supervision" && <AdminSupervision />}
      {active === "orientations" && <AdminOrientations />}
      {active === "historique" && <AbsenceHistory />}
      {active === "comptes" && user.role === "DIRECTEUR" && <AdminAccounts currentUser={user} />}
    </AppShell>
  );
}
