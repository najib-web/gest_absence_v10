"use client";

// Vue d'ensemble du Directeur : statistiques clés de l'établissement.

import { useI18n } from "@/lib/i18n-context";
import { useFetch, formatDate } from "@/lib/hooks";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, Send, CheckCircle2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DirectorOverview() {
  const { t, locale } = useI18n();
  const { data: studentsData } = useFetch<{ students: any[] }>("/api/students");
  const { data: classesData } = useFetch<{ classes: any[] }>("/api/classes?withCounts=true");
  const { data: teachersData } = useFetch<{ teachers: any[] }>("/api/teachers");
  const { data: absencesData } = useFetch<{ absences: any[] }>("/api/absences?oriented=true");
  const { data: accountsData } = useFetch<{ accounts: any[] }>("/api/director/accounts");

  const totalStudents = studentsData?.students.length ?? 0;
  const totalClasses = classesData?.classes.length ?? 0;
  const totalTeachers = teachersData?.teachers.length ?? 0;
  const totalSurveillants =
    accountsData?.accounts.filter((a) => a.role === "SURVEILLANT").length ?? 0;
  const orientedAbsences = absencesData?.absences ?? [];

  const recentOriented = orientedAbsences.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t.directorOverview}</h2>
        <p className="text-sm text-muted-foreground">{t.directorDashboard}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t.students} value={totalStudents} icon={<Users className="h-4 w-4" />} />
        <StatCard label={t.classes} value={totalClasses} icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label={t.teachers} value={totalTeachers} icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label={t.surveillant} value={totalSurveillants} icon={<Shield className="h-4 w-4" />} />
        <StatCard label={t.orientedStudents} value={orientedAbsences.length} icon={<Send className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-amber-500" />
            {t.orientedStudents}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOriented.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {t.noData}
            </div>
          ) : (
            <div className="space-y-2">
              {recentOriented.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {a.student.lastName} {a.student.firstName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.student.codeMassar} · {a.student.classe?.code}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-end">
                    <div>{formatDate(a.session.date, locale)}</div>
                    <div>{a.session.subject}</div>
                  </div>
                  <Badge variant={a.justified ? "default" : "destructive"}>
                    {a.justified ? t.justified : t.unjustified}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
