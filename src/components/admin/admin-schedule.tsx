"use client";

// Surveillant page: weekly service table (Lundi→Samedi, 8h→18h).
// Add / remove sessions for each teacher directly on the grid.

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPost, apiDelete } from "@/lib/hooks";
import { SUBJECTS } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, CalendarDays, FilterX, Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, FileDown, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WeeklyGrid } from "@/components/schedule/weekly-grid";
import {
  SCHOOL_START_MIN,
  SCHOOL_END_MIN,
  SLOT_DURATIONS_H,
  DAY_NAMES,
  minutesToLabel,
  type SlotWithPeople,
} from "@/lib/schedule";

interface SlotApi {
  id: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  subject: string;
  subjectAr: string | null;
  teacher: { id: string; firstName: string; lastName: string };
  classe: { code: string };
  groupe: { code: string } | null;
}

interface SlotPreviewRow {
  index: number;
  day: number | null;
  dayLabel: string;
  startMin: number | null;
  endMin: number | null;
  timeLabel: string;
  classeCode: string;
  classeLabel?: string;
  groupeCode: string;
  teacherName: string;
  teacherResolved: string | null;
  matiere: string;
  matiereAr: string | null;
  status: "create" | "update" | "error";
  errorCode?: string;
  summary?: never;
}

interface ImportSummary {
  toCreate: number;
  toUpdate: number;
  errors: number;
}

export function AdminSchedule() {
  const { t, locale } = useI18n();
  const { data: slotsData, loading, refresh } = useFetch<{ slots: SlotApi[] }>("/api/service-slots");
  const { data: teachersData } = useFetch<{ teachers: any[] }>("/api/teachers");
  const { data: classesData } = useFetch<{ classes: any[] }>("/api/classes");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState<{ dow: number; startMin: number; endMin: number } | null>(null);
  const [filterTeacher, setFilterTeacher] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<SlotPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const teachers = teachersData?.teachers ?? [];
  const classes = classesData?.classes ?? [];
  const allSlots = slotsData?.slots ?? [];

  const filteredSlots: SlotWithPeople[] = useMemo(
    () =>
      allSlots
        .filter((s) => filterTeacher === "all" || s.teacher.id === filterTeacher)
        .map((s) => ({ ...s, teacherId: s.teacher.id })),
    [allSlots, filterTeacher]
  );

  function openDialog(presetVal?: { dow: number; startMin: number; endMin: number }) {
    setPreset(presetVal ?? null);
    setDialogOpen(true);
  }

  async function handleFile(file: File) {
    lastFileRef.current = file;
    setUploading(true);
    setPreviewRows([]);
    setImportSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "preview");
      const res = await fetch("/api/service-slots/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t.error);
        return;
      }
      setPreviewRows(data.rows);
      setImportSummary(data.summary ?? null);
      setImportOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function commitImport() {
    if (previewRows.length === 0) return;
    setCommitting(true);
    try {
      const file = lastFileRef.current;
      if (!file) {
        toast.error(t.noFileSelected);
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "commit");
      const res = await fetch("/api/service-slots/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t.error);
        return;
      }
      toast.success(
        `${data.created} ${t.slotsImported}` +
        (data.updated ? `, ${data.updated} ${t.slotsUpdated}` : "") +
        (data.serviceTablesUpdated ? `, ${data.serviceTablesUpdated} ${t.serviceTablesSynced}` : "") +
        (data.skipped ? `, ${data.skipped} ${t.rowsSkipped.toLowerCase()}` : "")
      );
      setImportOpen(false);
      setPreviewRows([]);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = "/templates/tableaux%20de%20services.csv";
    a.download = "tableaux de services.csv";
    a.click();
  }

  // Export de la grille au même format que le tableau d'import (et que l'aperçu UI) :
  // Jour | Heure début | Heure fin | Classe | Groupe | Enseignant | Matière
  function buildExportRows() {
    const isAr = locale === "ar";
    const headers = isAr
      ? ["اليوم", "وقت البداية", "وقت النهاية", "القسم", "المجموعة", "الأستاذ", "المادة"]
      : ["Jour", "Heure début", "Heure fin", "Classe", "Groupe", "Enseignant", "Matière"];
    const sorted = [...allSlots].sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin
    );
    const body = sorted.map((s) => [
      DAY_NAMES[s.dayOfWeek - 1]?.[isAr ? "ar" : "fr"] ?? String(s.dayOfWeek),
      minutesToLabel(s.startMin),
      minutesToLabel(s.endMin),
      s.classe.code,
      s.groupe?.code ?? "",
      `${s.teacher.lastName} ${s.teacher.firstName}`,
      (isAr && s.subjectAr) || s.subject,
    ]);
    return { headers, body };
  }

  function exportScheduleXlsx() {
    if (allSlots.length === 0) {
      toast.error(t.noSlotsToExport);
      return;
    }
    const { headers, body } = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    ws["!cols"] = [12, 13, 13, 12, 11, 26, 20].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, locale === "ar" ? "الجدول" : "Grille");
    const fname = `grille_horaire_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`${t.exportOk} — ${fname}`);
  }

  function exportScheduleCsv() {
    if (allSlots.length === 0) {
      toast.error(t.noSlotsToExport);
      return;
    }
    const { headers, body } = buildExportRows();
    const csv =
      "\uFEFF" +
      [headers, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `grille_horaire_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(t.exportOk);
  }

  async function deleteSlot(slot: SlotWithPeople) {
    if (!confirm(t.confirmDelete)) return;
    try {
      await apiDelete(`/api/service-slots/${slot.id}`);
      toast.success(t.deleted);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            {t.weeklySchedule}
          </h2>
          <p className="text-sm text-muted-foreground">{t.weeklyScheduleDesc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterTeacher} onValueChange={setFilterTeacher}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder={t.allTeachers} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allTeachers}</SelectItem>
              {teachers.map((tc) => (
                <SelectItem key={tc.id} value={tc.id}>
                  {tc.lastName} {tc.firstName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterTeacher !== "all" && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setFilterTeacher("all")}>
              <FilterX className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={uploading}>
                <FileDown className="h-4 w-4 me-2" />
                {t.exportSchedule}
                <ChevronDown className="h-3.5 w-3.5 ms-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportScheduleXlsx}>
                <FileSpreadsheet className="h-4 w-4 me-2 text-emerald-600" />
                {t.exportXlsx}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportScheduleCsv}>
                <FileDown className="h-4 w-4 me-2 text-muted-foreground" />
                {t.exportCsv}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 me-2" />
            {t.templateServices}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
            {t.importServiceTable}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" onClick={() => openDialog()} disabled={teachers.length === 0 || classes.length === 0}>
            <Plus className="h-4 w-4 me-2" />
            {t.addSlot}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-3">
          <WeeklyGrid
            slots={filteredSlots}
            loading={loading}
            onDelete={deleteSlot}
            onEmptyClick={(dow, startMin, endMin) =>
              openDialog({ dow, startMin, endMin })
            }
          />
        </CardContent>
      </Card>

      <SlotDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preset={preset}
        teachers={teachers}
        classes={classes}
        onSaved={() => refresh()}
      />

      {/* Import Service Tables Preview Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {t.importServiceTable}
            </DialogTitle>
            <DialogDescription>
              {previewRows.length} {t.rowsFound}
              {importSummary && (
                <span className="ms-2 inline-flex gap-2">
                  <Badge className="bg-emerald-600 text-white">{importSummary.toCreate} {t.toCreate}</Badge>
                  {importSummary.toUpdate > 0 && (
                    <Badge variant="secondary">{importSummary.toUpdate} {t.toUpdate}</Badge>
                  )}
                  {importSummary.errors > 0 && (
                    <Badge variant="destructive">{importSummary.errors} {t.error}</Badge>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t.status}</TableHead>
                  <TableHead>{t.selectDay}</TableHead>
                  <TableHead>{t.timeSlot}</TableHead>
                  <TableHead>{t.classe}</TableHead>
                  <TableHead>{t.groupe}</TableHead>
                  <TableHead>{t.teacher}</TableHead>
                  <TableHead>{t.subject}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r) => (
                  <TableRow key={r.index}>
                    <TableCell>
                      {r.status !== "error" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>{r.dayLabel}</TableCell>
                    <TableCell className="font-mono text-xs">{r.timeLabel}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.classeLabel || r.classeCode || "—"}</Badge>
                    </TableCell>
                    <TableCell>{r.groupeCode ? <Badge variant="secondary">{r.groupeCode}</Badge> : <span className="text-xs text-muted-foreground">{t.noGroup}</span>}</TableCell>
                    <TableCell>
                      {r.teacherResolved ? (
                        <span className="text-sm">{r.teacherResolved}</span>
                      ) : (
                        <span className="text-xs text-destructive">{t.errTeacherNotFound}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.matiere ? (
                        <Badge variant="secondary">{r.matiere}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={commitImport}
              disabled={committing || previewRows.length === 0 || (importSummary?.toCreate ?? 0) + (importSummary?.toUpdate ?? 0) === 0}
            >
              {committing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
              {t.confirmImport} ({(importSummary?.toCreate ?? 0) + (importSummary?.toUpdate ?? 0)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SlotDialog({
  open,
  onOpenChange,
  preset,
  teachers,
  classes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preset: { dow: number; startMin: number; endMin: number } | null;
  teachers: any[];
  classes: any[];
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState("");
  const [startHour, setStartHour] = useState(""); // "8".."17"
  const [duration, setDuration] = useState("2"); // "1" | "2"
  const [classeId, setClasseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c.id === classeId);
  const groups = selectedClass?.groups ?? [];

  // Heures de début possibles selon la durée choisie (fin ≤ 18h)
  const startHours = Array.from({ length: 10 }, (_, i) => SCHOOL_START_MIN / 60 + i).filter(
    (h) => h + parseInt(duration) <= SCHOOL_END_MIN / 60
  );

  // Sync form when opened (optionally pre-filled from an empty grid cell)
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setTeacherId("");
    setClasseId("");
    setGroupId("");
    setSubject("");
    setDay(preset ? String(preset.dow) : "");
    if (preset) {
      setStartHour(String(Math.floor(preset.startMin / 60)));
      setDuration(String((preset.endMin - preset.startMin) / 60 || 2));
    } else {
      setStartHour("");
      setDuration("2");
    }
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const startMin = parseInt(startHour) * 60;
    const endMin = startMin + parseInt(duration) * 60;
    const subj = SUBJECTS.find((s) => s.fr === subject);
    setSaving(true);
    try {
      await apiPost("/api/service-slots", {
        teacherId,
        dayOfWeek: parseInt(day),
        startMin,
        endMin,
        classeId,
        groupId: groupId || null,
        subject,
        subjectAr: subj?.ar || null,
      });
      toast.success(t.created);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t.addSlot}
          </DialogTitle>
          <DialogDescription>{t.weeklyScheduleDesc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t.teacher}</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectTeacher} />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((tc) => (
                  <SelectItem key={tc.id} value={tc.id}>
                    {tc.lastName} {tc.firstName} — {tc.matiere}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t.selectDay}</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectDay} />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d) => (
                    <SelectItem key={d.dow} value={String(d.dow)}>
                      {d.fr} — {d.ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.duration}</Label>
              <Select
                value={duration}
                onValueChange={(v) => {
                  setDuration(v);
                  // Ajuster l'heure de début si la fin dépasserait 18h
                  if (startHour && parseInt(startHour) + parseInt(v) > SCHOOL_END_MIN / 60) {
                    setStartHour(String(SCHOOL_END_MIN / 60 - parseInt(v)));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectDuration} />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_DURATIONS_H.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h} {t.hourUnit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.startTime}</Label>
            <Select value={startHour} onValueChange={setStartHour}>
              <SelectTrigger>
                <SelectValue placeholder="08:00 → 18:00" />
              </SelectTrigger>
              <SelectContent>
                {startHours.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {minutesToLabel(h * 60)} → {minutesToLabel((h + parseInt(duration)) * 60)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t.classe}</Label>
              <Select value={classeId} onValueChange={(v) => { setClasseId(v); setGroupId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectClass} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.groupe} ({t.optional})</Label>
              <Select value={groupId} onValueChange={setGroupId} disabled={groups.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectGroup} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.subject}</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectSubject} />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s.fr} value={s.fr}>{s.fr} — {s.ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button
              type="submit"
              disabled={saving || !teacherId || !day || !startHour || !classeId || !subject}
            >
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
