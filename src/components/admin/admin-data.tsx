"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { apiPost } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarX,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Layers,
  ListOrdered,
  Loader2,
  School,
  BookOpen,
  TriangleAlert,
  Users,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

type Counts = Record<string, number>;

type TableDef = {
  key: string;
  /** Clé i18n du libellé de la table */
  labelKey: string;
  icon: React.ReactNode;
  /** Avertissement de cascade spécifique à afficher dans la confirmation */
  cascade?: "linked" | "teachers";
};

// Tables vidables individuellement, dans un ordre logique
const TABLES: TableDef[] = [
  { key: "absences", labelKey: "dataTableAbsences", icon: <CalendarX className="h-4 w-4" /> },
  { key: "orientations", labelKey: "dataTableOrientations", icon: <FileText className="h-4 w-4" /> },
  { key: "sessions", labelKey: "dataTableSessions", icon: <ClipboardList className="h-4 w-4" /> },
  { key: "serviceSlots", labelKey: "dataTableServiceSlots", icon: <CalendarDays className="h-4 w-4" /> },
  { key: "serviceTables", labelKey: "dataTableServiceTables", icon: <BookOpen className="h-4 w-4" /> },
  { key: "students", labelKey: "dataTableStudents", icon: <Users className="h-4 w-4" /> },
  { key: "teachers", labelKey: "dataTableTeachers", icon: <GraduationCap className="h-4 w-4" />, cascade: "teachers" },
  { key: "groups", labelKey: "dataTableGroups", icon: <Layers className="h-4 w-4" /> },
  { key: "classes", labelKey: "dataTableClasses", icon: <School className="h-4 w-4" />, cascade: "linked" },
  { key: "niveaux", labelKey: "dataTableNiveaux", icon: <ListOrdered className="h-4 w-4" />, cascade: "linked" },
];

export function AdminData() {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<TableDef | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/data");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setCounts(data.counts);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const label = (d: TableDef) => t[d.labelKey as keyof typeof t] as string;

  async function clearScope(scope: string, confirm?: string) {
    setBusyKey(scope);
    try {
      const data = await apiPost("/api/admin/data", { scope, confirm });
      const deleted: Counts = data.deleted || {};
      if (scope === "all") {
        toast.success(t.dataAllDeletedToast);
        // Les comptes ont été supprimés : déconnexion explicite.
        // Les comptes Directeur/Surveillant par défaut seront recréés au prochain login.
        setTimeout(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.reload();
        }, 1200);
        return;
      }
      const total = Object.values(deleted).reduce((a, b) => a + (b || 0), 0);
      toast.success((t.dataDeletedToast as string).replace("{count}", String(total)));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyKey(null);
      setPendingScope(null);
    }
  }

  const tableLabelOf = (scope: string) => {
    const d = TABLES.find((x) => x.key === scope);
    return d ? (t[d.labelKey as keyof typeof t] as string) : scope;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          {t.dataManagement}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{t.dataManagementDesc}</p>
      </div>

      {/* Tables individuelles */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dataTablesTitle}</CardTitle>
          <CardDescription>{t.dataTablesDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin me-2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {TABLES.map((d) => {
                const count = counts?.[d.key] ?? 0;
                return (
                  <div
                    key={d.key}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {d.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{label(d)}</div>
                      <div className="text-xs text-muted-foreground">
                        {count} {t.dataRecords}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyKey === d.key}
                      onClick={() => setPendingScope(d)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      {busyKey === d.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t.dataEmptyBtn
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zone dangereuse — toute la base */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-5 w-5" />
            {t.dataDangerZone}
          </CardTitle>
          <CardDescription>{t.dataAllTitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.dataAllDesc}</p>
          <Button
            variant="destructive"
            disabled={loading || busyKey === "all"}
            onClick={() => {
              setConfirmText("");
              setAllOpen(true);
            }}
          >
            {busyKey === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" />
            ) : null}
            {t.dataEmptyAllBtn}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation vider une table */}
      <AlertDialog
        open={!!pendingScope}
        onOpenChange={(o) => !o && setPendingScope(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.dataConfirmEmptyTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {(t.dataConfirmEmptyDesc as string).replace(
                "{table}",
                pendingScope ? tableLabelOf(pendingScope.key) : ""
              )}
              {pendingScope?.cascade === "linked" ? ` ${t.dataCascadeWarn}` : ""}
              {pendingScope?.cascade === "teachers" ? ` ${t.dataCascadeWarnTeachers}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (pendingScope) clearScope(pendingScope.key);
              }}
            >
              {t.dataEmptyBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation vider toute la base (confirmation tapée) */}
      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5" />
              {t.dataConfirmAllTitle}
            </DialogTitle>
            <DialogDescription>{t.dataAllDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Badge variant="destructive">{t.dataTypeConfirm}</Badge>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="VIDER"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "VIDER" || busyKey === "all"}
              onClick={() => clearScope("all", confirmText)}
            >
              {busyKey === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : null}
              {t.dataEmptyAllBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
