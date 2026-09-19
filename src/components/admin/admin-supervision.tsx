"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPatch } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Send, CheckCircle2, ShieldAlert, Search, Filter, BellOff, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/hooks";
import { useAttendanceMonitor } from "@/hooks/use-attendance-monitor";
import { slotRangeLabel, formatSeanceDateShort } from "@/lib/schedule";

export function AdminSupervision() {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<"all" | "oriented" | "justified" | "unjustified">("oriented");
  const [classeFilter, setClasseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [justifyTarget, setJustifyTarget] = useState<any | null>(null);

  // Appels non faits : séances commencées depuis plus de 5 min sans enregistrement
  // (disparaissent automatiquement dès l'appel enregistré, ou via suppression
  // manuelle par le surveillant — bouton X)
  const { missed, dismiss } = useAttendanceMonitor({ enabled: true });
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);

  async function handleDismiss(m: (typeof missed)[number]) {
    if (dismissingKey) return;
    setDismissingKey(m.key);
    try {
      await dismiss(m);
      toast.success(t.notificationDismissed);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDismissingKey(null);
    }
  }

  const filterParam = filter === "oriented" ? "oriented=true" : filter === "justified" ? "justified=true" : filter === "unjustified" ? "unjustified=true" : "";
  const { data: absencesData, loading, refresh } = useFetch<{ absences: any[] }>(
    `/api/absences?${filterParam}`
  );
  const { data: classesData } = useFetch<{ classes: any[] }>("/api/classes");

  const classes = classesData?.classes ?? [];
  let absences = absencesData?.absences ?? [];

  if (classeFilter !== "all") {
    absences = absences.filter((a) => a.student.classeId === classeFilter);
  }
  if (search) {
    const q = search.toLowerCase();
    absences = absences.filter(
      (a) =>
        a.student.firstName.toLowerCase().includes(q) ||
        a.student.lastName.toLowerCase().includes(q) ||
        a.student.codeMassar.toLowerCase().includes(q)
    );
  }

  async function markJustified(absence: any, reason: string) {
    try {
      await apiPatch(`/api/absences/${absence.id}`, { justified: true, reason });
      toast.success(t.saved);
      setJustifyTarget(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function unjustify(absence: any) {
    try {
      await apiPatch(`/api/absences/${absence.id}`, { justified: false, reason: null });
      toast.success(t.saved);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t.supervision}</h2>
        <p className="text-sm text-muted-foreground">{t.absences} — {t.surveillant}</p>
      </div>

      {/* Appels non faits (enseignants) */}
      <Card className={missed.length > 0 ? "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20" : "border-emerald-100 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className={`h-5 w-5 ${missed.length > 0 ? "text-red-500" : "text-emerald-500"}`} />
            {t.missedCallsTitle}
            {missed.length > 0 && (
              <Badge variant="destructive" className="ms-1">{missed.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>{t.missedCallsDesc}</CardDescription>
        </CardHeader>
        {missed.length > 0 && (
          <CardContent className="space-y-2">
            {missed.map((m) => (
              <div
                key={m.key}
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {m.teacherName || t.teacher}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.classeCode}{m.groupeCode ? ` · ${m.groupeCode}` : ""} — {locale === "ar" && m.subjectAr ? m.subjectAr : m.subject}
                  </div>
                </div>
                <Badge variant="outline" className="font-mono">
                  {formatSeanceDateShort(new Date(), locale)} · {slotRangeLabel(m.startMin, m.endMin)}
                </Badge>
                <Badge variant={m.slotOngoing ? "default" : "secondary"} className={m.slotOngoing ? "bg-red-600" : ""}>
                  {m.slotOngoing
                    ? t.missedCallLate.replace("{mins}", String(Math.max(m.minutesLate, 5)))
                    : t.missedCallNow}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  title={t.dismissNotification}
                  disabled={dismissingKey === m.key}
                  onClick={() => handleDismiss(m)}
                >
                  {dismissingKey === m.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Filter className="h-4 w-4" />
              {t.filter}:
            </div>
            <div className="flex gap-1 flex-wrap">
              {[
                { id: "oriented", label: t.oriented },
                { id: "unjustified", label: t.unjustified },
                { id: "justified", label: t.justified },
                { id: "all", label: t.allClasses },
              ].map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filter === f.id ? "default" : "outline"}
                  onClick={() => setFilter(f.id as any)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Select value={classeFilter} onValueChange={setClasseFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allClasses}</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {t.absences} ({absences.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.fullName}</TableHead>
                  <TableHead>{t.codeMassar}</TableHead>
                  <TableHead>{t.classe}</TableHead>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.subject}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="text-end">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : absences.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  absences.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.student.lastName} {a.student.firstName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.student.codeMassar}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.student.classe?.code}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(a.session.date, locale)}
                      </TableCell>
                      <TableCell className="text-sm">{a.session.subject}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={a.status === "ABSENT" ? "destructive" : "secondary"}>
                            {a.status === "ABSENT" ? t.absent : t.late}
                          </Badge>
                          {a.oriented && (
                            <Badge variant="outline" className="text-amber-600">
                              <Send className="h-3 w-3 me-1" />
                              {t.oriented}
                            </Badge>
                          )}
                          {a.justified && (
                            <Badge variant="default" className="bg-emerald-600">
                              <CheckCircle2 className="h-3 w-3 me-1" />
                              {t.justified}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end">
                          {!a.justified ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setJustifyTarget(a)}
                            >
                              <CheckCircle2 className="h-3 w-3 me-1" />
                              {t.justify}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => unjustify(a)}
                            >
                              {t.cancel}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Justify dialog */}
      <JustifyDialog
        absence={justifyTarget}
        onClose={() => setJustifyTarget(null)}
        onConfirm={markJustified}
      />
    </div>
  );
}

function JustifyDialog({
  absence,
  onClose,
  onConfirm,
}: {
  absence: any | null;
  onClose: () => void;
  onConfirm: (a: any, reason: string) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!absence) return;
    setSaving(true);
    await onConfirm(absence, reason);
    setSaving(false);
    setReason("");
  }

  return (
    <Dialog open={!!absence} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.justification}</DialogTitle>
          <DialogDescription>
            {absence && (
              <>
                {absence.student.lastName} {absence.student.firstName} — {absence.student.codeMassar}
                <br />
                {absence.session.subject} · {absence.session.classe?.code}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">{t.justificationText}</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.enterReason}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
              {t.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
