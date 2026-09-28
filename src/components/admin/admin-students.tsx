"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPost, apiDelete, apiPatch } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Plus,
  Phone,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PreviewRow {
  codeMassar: string;
  firstName: string;
  lastName: string;
  firstNameAr?: string;
  lastNameAr?: string;
  parentPhone?: string;
  classeCode: string;
  classeId: string | null;
  classeLabel: string;
  classeWillBeCreated: boolean;
  niveauLabel: string;
  resolvable: boolean;
}

interface ClasseToCreate {
  code: string;
  niveauCode: string;
  niveauLabel: string;
}

export function AdminStudents() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [classeFilter, setClasseFilter] = useState<string>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStudent, setDialogStudent] = useState<any | null>(null); // null = création
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: studentsData, loading, refresh } = useFetch<{ students: any[] }>("/api/students");
  const { data: classesData } = useFetch<{ classes: any[] }>("/api/classes");

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [classesToCreate, setClassesToCreate] = useState<ClasseToCreate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const lastFileRef = useRef<File | null>(null);

  const students = studentsData?.students ?? [];
  const classes = classesData?.classes ?? [];

  const filtered = students.filter((s) => {
    if (classeFilter !== "all" && s.classeId !== classeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        (s.firstNameAr || "").includes(q) ||
        (s.lastNameAr || "").includes(q) ||
        s.codeMassar.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleFile(file: File) {
    lastFileRef.current = file;
    setUploading(true);
    setPreviewRows([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "preview");
      const res = await fetch("/api/students/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t.error);
        return;
      }
      setPreviewRows(data.rows);
      setClassesToCreate(data.classesToCreate ?? []);
      setPreviewOpen(true);
      toast.success(`${data.totalRows} ${t.rowsFound}`);
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
      // Re-upload in commit mode (re-parse + insert)
      const file = lastFileRef.current;
      if (!file) {
        toast.error(t.noFileSelected);
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "commit");
      const res = await fetch("/api/students/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t.error);
        return;
      }
      toast.success(
        `${data.inserted} ${t.studentsImported}` +
        (data.classesCreated ? `, ${data.classesCreated} ${t.classes} ${t.created.toLowerCase()}` : "") +
        (data.skipped ? `, ${data.skipped} ${t.rowsSkipped.toLowerCase()}` : "")
      );
      setPreviewOpen(false);
      setPreviewRows([]);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  function downloadTemplate() {
    // Fichier modèle Excel officiel (élèves + classe + niveau)
    const a = document.createElement("a");
    a.href = "/templates/ListEleve_20260905.xlsx";
    a.download = "ListEleve_20260905.xlsx";
    a.click();
  }

  function exportStudents() {
    // Liste COMPLÈTE des élèves de l'établissement (indépendante des filtres UI).
    // En-têtes FR/AR alignés sur les alias du parseur d'import (src/lib/excel.ts)
    // → le fichier exporté est directement ré-importable (round-trip).
    if (students.length === 0) {
      toast.error(t.noStudentsToExport);
      return;
    }
    const isAr = locale === "ar";
    const headers = isAr
      ? ["الرمز المساري", "النسب", "الاسم الشخصي", "النسب بالعربية", "الاسم بالعربية", "هاتف ولي الأمر", "القسم", "المجموعة", "المستوى", "الغيابات", "التأخرات", "غير المبررة", "التوجيهات"]
      : ["Code Massar", "Nom", "Prénom", "Nom (arabe)", "Prénom (arabe)", "Téléphone parent", "Classe", "Groupe", "Niveau", "Absences", "Retards", "Non justifiés", "Orientations"];
    const body = students.map((s) => [
      s.codeMassar,
      s.lastName,
      s.firstName,
      s.lastNameAr || "",
      s.firstNameAr || "",
      s.parentPhone || "",
      s.classe?.code ?? "",
      s.groupe?.code ?? "",
      s.classe?.niveau ? (isAr ? s.classe.niveau.labelAr : s.classe.niveau.labelFr) : "",
      s.stats.totalAbs,
      s.stats.totalLate,
      s.stats.unjustified,
      s.stats.oriented,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    ws["!cols"] = [14, 16, 16, 18, 18, 16, 10, 10, 22, 10, 10, 12, 12].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    if (isAr) (wb as any).Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, isAr ? "التلاميذ" : "Élèves");
    const fname = `ListeEleves_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`${t.exportComplete} · ${students.length} ${t.students}`);
  }

  async function deleteStudent(id: string) {
    if (!confirm(t.confirmDelete)) return;
    try {
      await apiDelete(`/api/students/${id}`);
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
          <h2 className="text-2xl font-bold tracking-tight">{t.students}</h2>
          <p className="text-sm text-muted-foreground">{t.studentList}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportStudents} title={t.exportComplete}>
            <Download className="h-4 w-4 me-2" />
            {t.download}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate} title={t.importTemplate}>
            <FileSpreadsheet className="h-4 w-4 me-2" />
            <span className="hidden md:inline">{t.importTemplate}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setDialogStudent(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 me-2" />
            {t.add}
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
            {t.import}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
                  <SelectItem key={c.id} value={c.id}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.codeMassar}</TableHead>
                  <TableHead>{t.lastName}</TableHead>
                  <TableHead>{t.firstName}</TableHead>
                  <TableHead dir="rtl" className="font-arabic">{t.lastNameAr}</TableHead>
                  <TableHead dir="rtl" className="font-arabic">{t.firstNameAr}</TableHead>
                  <TableHead>{t.parentPhone}</TableHead>
                  <TableHead>{t.classe}</TableHead>
                  <TableHead>{t.groupe}</TableHead>
                  <TableHead className="text-center">{t.absences}</TableHead>
                  <TableHead className="text-end">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.codeMassar}</TableCell>
                      <TableCell className="font-medium">{s.lastName}</TableCell>
                      <TableCell>{s.firstName}</TableCell>
                      <TableCell dir="rtl" className="font-arabic">{s.lastNameAr || "—"}</TableCell>
                      <TableCell dir="rtl" className="font-arabic">{s.firstNameAr || "—"}</TableCell>
                      <TableCell>
                        {s.parentPhone ? (
                          <a
                            href={`tel:${s.parentPhone}`}
                            title={t.callParent}
                            className="inline-flex items-center gap-1.5 text-emerald-600 hover:underline font-mono text-xs"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {s.parentPhone}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.classe?.code}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.groupe ? (
                          <Badge variant="secondary">{s.groupe.code}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t.noGroup}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {s.stats.totalAbs > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {s.stats.totalAbs} {t.absent}
                            </Badge>
                          )}
                          {s.stats.totalLate > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {s.stats.totalLate} {t.late}
                            </Badge>
                          )}
                          {s.stats.oriented > 0 && (
                            <Badge variant="outline" className="text-xs text-amber-600">
                              {s.stats.oriented} {t.oriented}
                            </Badge>
                          )}
                          {s.stats.totalAbs === 0 && s.stats.totalLate === 0 && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t.edit}
                            onClick={() => { setDialogStudent(s); setDialogOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteStudent(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Import Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {t.importPreview}
            </DialogTitle>
            <DialogDescription>
              {previewRows.length} {t.rowsFound} — {t.classeAutoCreated}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {classesToCreate.length > 0 && (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 p-3">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Plus className="h-4 w-4" /> {t.classesToCreate} ({classesToCreate.length})
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {classesToCreate.map((c) => (
                    <Badge key={c.code} variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                      {c.code} · {c.niveauLabel}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t.status}</TableHead>
                  <TableHead>{t.codeMassar}</TableHead>
                  <TableHead>{t.lastName}</TableHead>
                  <TableHead>{t.firstName}</TableHead>
                  <TableHead dir="rtl" className="font-arabic">{t.lastNameAr}</TableHead>
                  <TableHead dir="rtl" className="font-arabic">{t.firstNameAr}</TableHead>
                  <TableHead>{t.parentPhone}</TableHead>
                  <TableHead>{t.classe}</TableHead>
                  <TableHead>{t.niveau}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {r.resolvable ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.codeMassar}</TableCell>
                    <TableCell className="font-medium">{r.lastName}</TableCell>
                    <TableCell>{r.firstName}</TableCell>
                    <TableCell dir="rtl" className="font-arabic">{r.lastNameAr || "—"}</TableCell>
                    <TableCell dir="rtl" className="font-arabic">{r.firstNameAr || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.parentPhone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{r.classeLabel}</Badge>
                        {r.classeWillBeCreated && (
                          <Badge className="bg-emerald-600 text-white text-[10px]">+ {t.newClasse}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.niveauLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={commitImport} disabled={committing || previewRows.length === 0}>
              {committing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
              {t.confirmImport} ({previewRows.filter((r) => r.resolvable).length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Student Modal */}
      <StudentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        classes={classes}
        student={dialogStudent}
        onSaved={() => refresh()}
      />
    </div>
  );
}

function StudentDialog({
  open,
  onOpenChange,
  classes,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: any[];
  /** null = création, objet = édition */
  student: any | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [codeMassar, setCodeMassar] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstNameAr, setFirstNameAr] = useState("");
  const [lastNameAr, setLastNameAr] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [classeId, setClasseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);

  const editing = !!student;

  // Pré-remplissage à l'ouverture (édition)
  useEffect(() => {
    if (open) {
      setCodeMassar(student?.codeMassar ?? "");
      setFirstName(student?.firstName ?? "");
      setLastName(student?.lastName ?? "");
      setFirstNameAr(student?.firstNameAr ?? "");
      setLastNameAr(student?.lastNameAr ?? "");
      setParentPhone(student?.parentPhone ?? "");
      setClasseId(student?.classeId ?? "");
      setGroupId(student?.groupId ?? "");
    }
  }, [open, student]);

  const selectedClass = classes.find((c) => c.id === classeId);
  const groups = selectedClass?.groups ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        codeMassar,
        firstName,
        lastName,
        classeId,
        groupId: groupId || null,
        firstNameAr: firstNameAr || null,
        lastNameAr: lastNameAr || null,
        parentPhone: parentPhone || null,
      };
      if (editing) {
        await apiPatch(`/api/students/${student.id}`, payload);
        toast.success(t.studentUpdated);
      } else {
        await apiPost("/api/students", payload);
        toast.success(t.created);
      }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? (
              <Pencil className="h-5 w-5 text-primary" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
            {editing ? t.editStudent : t.add}
          </DialogTitle>
          <DialogDescription>{t.studentList}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cm">{t.codeMassar}</Label>
            <Input
              id="cm"
              value={codeMassar}
              onChange={(e) => setCodeMassar(e.target.value)}
              placeholder="R13000001"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fn">{t.firstName}</Label>
              <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln">{t.lastName}</Label>
              <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fnar">{t.firstNameAr}</Label>
              <Input id="fnar" dir="rtl" className="font-arabic" value={firstNameAr} onChange={(e) => setFirstNameAr(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lnar">{t.lastNameAr}</Label>
              <Input id="lnar" dir="rtl" className="font-arabic" value={lastNameAr} onChange={(e) => setLastNameAr(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp">{t.parentPhone} ({t.optional})</Label>
            <Input id="pp" type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="06 12 34 56 78" />
          </div>
          <div className="space-y-2">
            <Label>{t.classe}</Label>
            <Select value={classeId} onValueChange={(v) => { setClasseId(v); setGroupId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectClass} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.labelFr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {groups.length > 0 && (
            <div className="space-y-2">
              <Label>{t.groupe} ({t.optional})</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectGroup} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
