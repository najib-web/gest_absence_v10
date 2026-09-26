"use client";

// Section "Base de Données" : réinitialisation complète (vider puis remplir
// à nouveau via les imports), réservée au surveillant.

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPost } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Database,
  Trash2,
  Loader2,
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  ShieldAlert,
  UserCheck,
  Info,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

interface DbStats {
  absences: number;
  orientations: number;
  students: number;
  groups: number;
  classes: number;
  niveaux: number;
  teachers: number;
  serviceSlots: number;
}

export function AdminDatabase() {
  const { t } = useI18n();
  const { data, loading, refresh } = useFetch<{ stats: DbStats }>("/api/database/reset");
  const [resetting, setResetting] = useState(false);

  const stats = data?.stats;

  async function resetDatabase() {
    setResetting(true);
    try {
      await apiPost("/api/database/reset");
      toast.success(t.resetSuccess);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  const statItems = stats
    ? [
        { icon: <Users className="h-4 w-4 text-primary" />, label: t.students, value: stats.students },
        { icon: <BookOpen className="h-4 w-4 text-primary" />, label: t.teachers, value: stats.teachers },
        { icon: <GraduationCap className="h-4 w-4 text-primary" />, label: t.classes, value: stats.classes },
        { icon: <Layers className="h-4 w-4 text-primary" />, label: t.groups, value: stats.groups },
        { icon: <CalendarDays className="h-4 w-4 text-primary" />, label: t.weeklySchedule, value: stats.serviceSlots },
        { icon: <ShieldAlert className="h-4 w-4 text-primary" />, label: t.absences, value: stats.absences },
        { icon: <UserCheck className="h-4 w-4 text-primary" />, label: t.orientations, value: stats.orientations },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          {t.database}
        </h2>
        <p className="text-sm text-muted-foreground">{t.databaseDesc}</p>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.dbStats}</CardTitle>
          <CardDescription>{t.databaseDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !stats ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {statItems.map((item, i) => (
                <div key={i} className="rounded-lg border p-3 flex flex-col items-center gap-1">
                  {item.icon}
                  <span className="text-2xl font-bold tabular-nums">{item.value ?? "—"}</span>
                  <span className="text-xs text-muted-foreground text-center">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t.resetDatabase}
          </CardTitle>
          <CardDescription>{t.resetDatabaseHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-4 mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              {t.resetDatabaseWarning}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={resetting}>
                {resetting ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 me-2" />
                )}
                {t.resetDatabase}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.resetDatabaseTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.resetDatabaseWarning}
                  <br />
                  <br />
                  {t.resetDatabaseHint}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    resetDatabase();
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {resetting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
                  {t.resetDatabaseAction}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {resetting && (
            <Badge variant="outline" className="ms-3">
              {t.loading}
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
