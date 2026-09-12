"use client";

// Surveillant page: absence threshold settings, students exceeding the threshold,
// teacher orientation reports (printable PDF), and all orientations management.

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPost, apiPatch, apiDelete, apiPut, formatDateShort } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportPrintDialog, type PrintOrientation } from "@/components/report-print";
import {
  Loader2,
  Settings2,
  AlertTriangle,
  FileText,
  UserCheck,
  Printer,
  Eye,
  CheckCircle2,
  RotateCcw,
  Send,
  Trash2,
  Users,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

interface StudentCount {
  id: string;
  codeMassar: string;
  firstName: string;
  lastName: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  parentPhone?: string | null;
  classe: { id: string; code: string };
  groupe: { id: string; code: string } | null;
  totalAbsences: number;
  unjustifiedAbsences: number;
  lateCount: number;
  exceeded: boolean;
  atLimit: boolean;
}

interface Orientation {
  id: string;
  title: string;
  content: string;
  source: string;
  status: string;
  createdAt: string;
  thresholdAtCreation: number | null;
  resolutionNote: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    codeMassar: string;
    classe: { code: string };
    groupe: { code: string } | null;
  };
  teacher?: { firstName: string; lastName: string; matiere: string } | null;
  session?: { date: string; subject: string } | null;
  unjustifiedAbsences?: number;
  threshold?: number;
}

export function AdminOrientations() {
  const { t, locale } = useI18n();

  // Data
  const { data: settingsData, refresh: refreshSettings } = useFetch<{ settings: { absenceThreshold: number } }>(
    "/api/settings"
  );
  const { data: countsData, loading: loadingCounts, refresh: refreshCounts } = useFetch<{
    threshold: number;
    students: StudentCount[];
  }>("/api/students/absence-counts");
  const { data: orData, loading: loadingOr, refresh: refreshOr } = useFetch<{ orientations: Orientation[] }>(
    "/api/orientations"
  );
  const { data: classesData } = useFetch<{ classes: any[] }>("/api/classes");

  // Threshold form
  const [thresholdInput, setThresholdInput] = useState<string>("");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const threshold = settingsData?.settings.absenceThreshold ?? 3;

  // Filters
  const [classeFilter, setClasseFilter] = useState("all");
  const [onlyExceeded, setOnlyExceeded] = useState(true);

  // Dialogs
  const [orientTarget, setOrientTarget] = useState<StudentCount | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintOrientation | null>(null);
  const [viewTarget, setViewTarget] = useState<Orientation | null>(null);

  const classes = classesData?.classes ?? [];
  const students = countsData?.students ?? [];

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => classeFilter === "all" || s.classe.id === classeFilter)
      .filter((s) => (onlyExceeded ? s.exceeded || s.atLimit : true))
      .sort((a, b) => b.unjustifiedAbsences - a.unjustifiedAbsences);
  }, [students, classeFilter, onlyExceeded]);

  const orientations = orData?.orientations ?? [];
  const teacherReports = orientations.filter((o) => o.source === "TEACHER");
  const pendingReports = teacherReports.filter((o) => o.status === "PENDING");

  async function saveThreshold() {
    const v = parseInt(thresholdInput);
    if (isNaN(v) || v < 1) {
      toast.error(t.invalidThreshold);
      return;
    }
    setSavingThreshold(true);
    try {
      await apiPut("/api/settings", { absenceThreshold: v });
      toast.success(t.saved);
      setThresholdInput("");
      refreshSettings();
      refreshCounts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingThreshold(false);
    }
  }

  async function markProcessed(o: Orientation) {
    try {
      await apiPatch(`/api/orientations/${o.id}`, { status: "RESOLVED" });
      toast.success(t.saved);
      refreshOr();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reopen(o: Orientation) {
    try {
      await apiPatch(`/api/orientations/${o.id}`, { status: "PENDING" });
      toast.success(t.saved);
      refreshOr();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeOrientation(o: Orientation) {
    if (!confirm(t.confirmDelete)) return;
    try {
      await apiDelete(`/api/orientations/${o.id}`);
      toast.success(t.deleted);
      refreshOr();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function toPrintTarget(o: Orientation): PrintOrientation {
    return {
      id: o.id,
      title: o.title,
      content: o.content,
      source: o.source,
      status: o.status,
      createdAt: o.createdAt,
      signature: (o as any).signature ?? null,
      thresholdAtCreation: o.thresholdAtCreation,
      unjustifiedAbsences: o.unjustifiedAbsences,
      threshold: o.threshold,
      student: o.student,
      teacher: o.teacher
        ? { ...o.teacher, matiereAr: (o.teacher as any).matiereAr ?? null }
        : null,
      session: o.session ?? null,
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t.orientationsManagement}</h2>
        <p className="text-sm text-muted-foreground">{t.orientationsDesc}</p>
      </div>

      <Tabs defaultValue="threshold">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="threshold" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            {t.thresholdTab} {threshold > 0 && <Badge variant="secondary">{threshold}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="exceeded" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            {t.exceededTab}
            {filteredStudents.length > 0 && <Badge variant="destructive">{filteredStudents.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-4 w-4" />
            {t.reportsTab}
            {pendingReports.length > 0 && <Badge className="bg-amber-600">{pendingReports.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <UserCheck className="h-4 w-4" />
            {t.orientedStudents}
          </TabsTrigger>
        </TabsList>

        {/* ===== Threshold settings ===== */}
        <TabsContent value="threshold" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                {t.absenceThreshold}
              </CardTitle>
              <CardDescription>{t.thresholdDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2 w-40">
                  <Label htmlFor="threshold">{t.maxAuthorizedAbsences}</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min={1}
                    max={100}
                    value={thresholdInput || String(threshold)}
                    onChange={(e) => setThresholdInput(e.target.value)}
                  />
                </div>
                <Button onClick={saveThreshold} disabled={savingThreshold}>
                  {savingThreshold ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                  {t.save}
                </Button>
              </div>
              <div className="rounded-md bg-muted/50 border p-3 text-sm text-muted-foreground">
                {t.thresholdCurrentIntro} <b className="text-foreground">{threshold}</b> {t.thresholdCurrentOutro}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Students exceeding threshold ===== */}
        <TabsContent value="exceeded" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-red-500" />
                  {t.studentsExceeding}
                </CardTitle>
                <CardDescription>{t.studentsExceedingDesc}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={classeFilter} onValueChange={setClasseFilter}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allClasses}</SelectItem>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={onlyExceeded ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setOnlyExceeded(!onlyExceeded)}
                >
                  {onlyExceeded ? t.exceededOnly : t.allStudents}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>{t.fullName}</TableHead>
                      <TableHead>{t.codeMassar}</TableHead>
                      <TableHead>{t.classe}</TableHead>
                      <TableHead>{t.unjustifiedAbsencesCount}</TableHead>
                      <TableHead className="w-40">{t.thresholdProgress}</TableHead>
                      <TableHead>{t.parentPhone}</TableHead>
                      <TableHead className="text-end">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCounts ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {t.noStudentExceeds}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((s) => (
                        <TableRow key={s.id} className={s.exceeded ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                          <TableCell className="font-medium">
                            {s.lastName} {s.firstName}
                            {(s.lastNameAr || s.firstNameAr) && (
                              <span dir="rtl" className="block font-arabic text-xs text-muted-foreground">
                                {[s.lastNameAr, s.firstNameAr].filter(Boolean).join(" ")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{s.codeMassar}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{s.classe.code}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${s.exceeded ? "text-red-600" : s.atLimit ? "text-amber-600" : ""}`}>
                              {s.unjustifiedAbsences}
                            </span>
                            <span className="text-muted-foreground text-xs"> / {s.totalAbsences} {t.absences.toLowerCase()}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(100, (s.unjustifiedAbsences / Math.max(threshold, 1)) * 100)}
                                className="h-2"
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {s.unjustifiedAbsences}/{threshold}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {s.parentPhone ? (
                              <a
                                href={`tel:${s.parentPhone}`}
                                title={t.callParent}
                                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-xs text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {s.parentPhone}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">{t.phoneMissing}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            {s.exceeded || s.atLimit ? (
                              <Button size="sm" className="h-7 text-xs" onClick={() => setOrientTarget(s)}>
                                <Send className="h-3 w-3 me-1" />
                                {t.orient}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Teacher reports ===== */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                {t.teacherReports}
              </CardTitle>
              <CardDescription>{t.teacherReportsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>{t.fullName}</TableHead>
                      <TableHead>{t.classe}</TableHead>
                      <TableHead>{t.teacher}</TableHead>
                      <TableHead>{t.date}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead className="text-end">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOr ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : teacherReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {t.noReports}
                        </TableCell>
                      </TableRow>
                    ) : (
                      teacherReports.map((o) => (
                        <TableRow key={o.id} className={o.status === "PENDING" ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
                          <TableCell className="font-medium">
                            {o.student.lastName} {o.student.firstName}
                            <div className="text-xs text-muted-foreground font-normal truncate max-w-48">{o.title}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{o.student.classe?.code}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {o.teacher ? `${o.teacher.lastName} ${o.teacher.firstName}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateShort(o.createdAt, locale)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={o.status} t={t} />
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setViewTarget(o)}>
                                <Eye className="h-3 w-3 me-1" />
                                {t.view}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setPrintTarget(toPrintTarget(o))}
                              >
                                <Printer className="h-3 w-3 me-1" />
                                {t.print}
                              </Button>
                              {o.status === "PENDING" ? (
                                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markProcessed(o)}>
                                  <CheckCircle2 className="h-3 w-3 me-1" />
                                  {t.markProcessed}
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => reopen(o)} title={t.reopen}>
                                  <RotateCcw className="h-3 w-3" />
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
        </TabsContent>

        {/* ===== All orientations ===== */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                {t.allOrientations}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>{t.fullName}</TableHead>
                      <TableHead>{t.classe}</TableHead>
                      <TableHead>{t.origin}</TableHead>
                      <TableHead>{t.date}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead className="text-end">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOr ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : orientations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t.noData}
                        </TableCell>
                      </TableRow>
                    ) : (
                      orientations.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">
                            {o.student.lastName} {o.student.firstName}
                            <div className="text-xs text-muted-foreground font-normal truncate max-w-48">{o.title}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{o.student.classe?.code}</Badge>
                          </TableCell>
                          <TableCell>
                            <OriginBadge source={o.source} t={t} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateShort(o.createdAt, locale)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={o.status} t={t} />
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setViewTarget(o)}>
                                <Eye className="h-3 w-3 me-1" />
                                {t.view}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setPrintTarget(toPrintTarget(o))}
                              >
                                <Printer className="h-3 w-3 me-1" />
                                {t.print}
                              </Button>
                              {o.status === "PENDING" ? (
                                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markProcessed(o)}>
                                  <CheckCircle2 className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => reopen(o)}>
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => removeOrientation(o)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
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
        </TabsContent>
      </Tabs>

      {/* Orient student dialog (from threshold tab) */}
      <OrientStudentDialog
        target={orientTarget}
        threshold={threshold}
        onClose={() => setOrientTarget(null)}
        onSaved={() => {
          refreshOr();
          refreshCounts();
        }}
      />

      {/* View report dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(v) => !v && setViewTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewTarget?.title}</DialogTitle>
            <DialogDescription>
              {viewTarget && (
                <>
                  {viewTarget.student.lastName} {viewTarget.student.firstName} — {viewTarget.student.codeMassar}
                  {viewTarget.teacher && (
                    <> · {t.teacher}: {viewTarget.teacher.lastName} {viewTarget.teacher.firstName}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{viewTarget?.content}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>{t.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print dialog */}
      <ReportPrintDialog
        orientation={printTarget}
        open={!!printTarget}
        onOpenChange={(v) => !v && setPrintTarget(null)}
      />
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: any }) {
  return status === "RESOLVED" ? (
    <Badge variant="default" className="bg-emerald-600">
      <CheckCircle2 className="h-3 w-3 me-1" />
      {t.processed}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-amber-600 border-amber-300">
      {t.pending}
    </Badge>
  );
}

function OriginBadge({ source, t }: { source: string; t: any }) {
  if (source === "TEACHER") {
    return (
      <Badge variant="secondary">
        <FileText className="h-3 w-3 me-1" />
        {t.originTeacher}
      </Badge>
    );
  }
  if (source === "SEUIL") {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="h-3 w-3 me-1" />
        {t.originThreshold}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Settings2 className="h-3 w-3 me-1" />
      {t.originManual}
    </Badge>
  );
}

function OrientStudentDialog({
  target,
  threshold,
  onClose,
  onSaved,
}: {
  target: StudentCount | null;
  threshold: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [wasOpen, setWasOpen] = useState(false);
  if (target && !wasOpen) {
    setWasOpen(true);
    setContent(
      t.defaultOrientationContent
        .replace("{count}", String(target.unjustifiedAbsences))
        .replace("{threshold}", String(threshold))
    );
  } else if (!target && wasOpen) {
    setWasOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      await apiPost("/api/orientations", {
        studentId: target.id,
        title: t.orientationTitle,
        content,
        source: "SEUIL",
      });
      toast.success(t.orientationCreated);
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.orientStudent}</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                {target.lastName} {target.firstName} — {target.codeMassar} ({target.classe.code})
                <br />
                {t.unjustifiedAbsencesCount}: <b>{target.unjustifiedAbsences}</b> / {t.threshold}: <b>{threshold}</b>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="or-content">{t.reportContent}</Label>
            <Textarea
              id="or-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" disabled={saving || !content.trim()}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
              {t.confirmOrientationBtn}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
