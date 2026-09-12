"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { AppShell, type SessionUser, type NavItem } from "@/components/app-shell";
import { LayoutDashboard, CalendarClock, ClipboardCheck, Send, CalendarDays, History, UserPen } from "lucide-react";
import { TeacherOverview } from "@/components/teacher/teacher-overview";
import { TeacherSessions } from "@/components/teacher/teacher-sessions";
import { TeacherAttendance } from "@/components/teacher/teacher-attendance";
import { TeacherOriented } from "@/components/teacher/teacher-oriented";
import { TeacherSchedule } from "@/components/teacher/teacher-schedule";
import { AbsenceHistory } from "@/components/absence-history";
import { TeacherProfile } from "@/components/teacher/teacher-profile";

export function TeacherDashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { t } = useI18n();
  const [active, setActive] = useState("overview");
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);
  const [attendanceReturn, setAttendanceReturn] = useState<string>("sessions");

  function openAttendance(id: string, from: string = "sessions") {
    setAttendanceSessionId(id);
    setAttendanceReturn(from);
    setActive("attendance");
  }

  function backFromAttendance() {
    setAttendanceSessionId(null);
    setActive(attendanceReturn);
  }

  const navItems: NavItem[] = [
    { id: "overview", label: t.overview, icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "schedule", label: t.mySchedule, icon: <CalendarDays className="h-4 w-4" /> },
    { id: "sessions", label: t.mySessions, icon: <CalendarClock className="h-4 w-4" /> },
    { id: "oriented", label: t.orientedStudents, icon: <Send className="h-4 w-4" /> },
    { id: "historique", label: t.absenceHistory, icon: <History className="h-4 w-4" /> },
    { id: "profile", label: t.myProfileSignature, icon: <UserPen className="h-4 w-4" /> },
  ];

  // Hide nav when in attendance view (full focus)
  if (active === "attendance" && attendanceSessionId) {
    return (
      <AppShell
        user={user}
        navItems={[
          { id: "back", label: t.back, icon: <LayoutDashboard className="h-4 w-4" /> },
        ]}
        activeId="back"
        onNavigate={backFromAttendance}
        onLogout={onLogout}
      >
        <TeacherAttendance sessionId={attendanceSessionId} onBack={backFromAttendance} />
      </AppShell>
    );
  }

  return (
    <AppShell user={user} navItems={navItems} activeId={active} onNavigate={setActive} onLogout={onLogout}>
      {active === "overview" && (
        <TeacherOverview
          user={user}
          onOpenAttendance={(id) => openAttendance(id, "overview")}
        />
      )}
      {active === "schedule" && <TeacherSchedule user={user} />}
      {active === "sessions" && (
        <TeacherSessions user={user} onOpenAttendance={(id) => openAttendance(id, "sessions")} />
      )}
      {active === "oriented" && <TeacherOriented user={user} />}
      {active === "historique" && <AbsenceHistory />}
      {active === "profile" && <TeacherProfile user={user} />}
    </AppShell>
  );
}
