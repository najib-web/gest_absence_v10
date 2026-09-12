"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPost, apiDelete, apiPatch } from "@/lib/hooks";
import { SUBJECTS } from "@/lib/subjects";
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
import { Plus, Trash2, Loader2, BookOpen, UserPlus, CalendarClock, Layers, Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeacherPreviewRow {
  index: number;
  firstName: string;
  lastName: string;
  matiere: string;
  matiereAr: string | null;
  emailInput: string;
  email: string;
  emailGenerated: boolean;
  password: string;
  valid: boolean;
  errorCode?: string;
}

export function AdminTeachers() {
  const { t } = useI18n();
  const { data: teachersData, loading, refresh } = useFetch<{ teachers: any[] }>("/api/teachers");
  const { data: classesData } = useFetch<{ classes: any[] }>("/api/classes");
  const { data: servicesData, refresh: refreshServices } = useFetch<{ services: any[] }>("/api/service-tables");

  const [teacherOpen, setTeacherOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<TeacherPreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFileRef = useRef<File | null>(null);

  // Réinitialisation du mot de passe d'un enseignant (par le surveillant)
  const [pwdTarget, setPwdTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdTarget) return;
    setPwdSaving(true);
    try {
      await apiPatch(`/api/users/${pwdTarget.id}`, { password: newPassword });
      toast.success(t.passwordUpdated);
      setPwdTarget(null);
      setNewPassword("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPwdSaving(false);
    }
  }

  const teachers = teachersData?.teachers ?? [];
  const classes = classesData?.classes ?? [];
  const services = servicesData?.services ?? [];

  async function handleFile(file: File) {
    lastFileRef.current = file;
    setUploading(true);
    setPreviewRows([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "preview");
      const res = await fetch("/api/teachers/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t.error);
        return;
      }
      setPreviewRows(data.rows);
      setImportOpen(true);
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
      const file = lastFileRef.current;
      if (!file) {
        toast.error(t.noFileSelected);
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "commit");
      const res = await fetch("/api/teachers/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t.error);
        return;
      }
      toast.success(
        `${data.created} ${t.teachersImported}` +
        (data.updated ? `, ${data.updated} ${t.teachersUpdated}` : "") +
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

  async function deleteService(id: string) {
    if (!confirm(t.confirmDelete)) return;
    try {
      await apiDelete(`/api/service-tables/${id}`);
      toast.success(t.deleted);
      refreshServices();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t.teachers} & {t.serviceTables}</h2>
          <p className="text-sm text-muted-foreground">{t.serviceTablesDesc}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/templates/Liste%20enseignants.xlsx";
              a.download = "Liste enseignants.xlsx";
              a.click();
            }}
          >
            <Download className="h-4 w-4 me-2" />
            {t.templateProfs}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
            {t.importTeachers}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTeacherOpen(true)}>
            <UserPlus className="h-4 w-4 me-2" />
            {t.createTeacher}
          </Button>
          <Button size="sm" onClick={() => setServiceOpen(true)} disabled={teachers.length === 0 || classes.length === 0}>
            <Plus className="h-4 w-4 me-2" />
            {t.assignService}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Teachers list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {t.teachers} ({teachers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.fullName}</TableHead>
                  <TableHead>{t.email}</TableHead>
                  <TableHead>{t.subject}</TableHead>
                  <TableHead className="text-center">{t.serviceTables}</TableHead>
                  <TableHead className="text-center">{t.sessions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : teachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  teachers.map((tc) => (
                    <TableRow key={tc.id}>
                      <TableCell className="font-medium">
                        {tc.lastName} {tc.firstName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tc.user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{tc.matiere}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{tc.services.length}</TableCell>
                      <TableCell className="text-center">{tc._count.sessions}</TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={t.resetPassword}
                          onClick={() => {
                            setPwdTarget({
                              id: tc.userId,
                              name: `${tc.lastName} ${tc.firstName}`,
                              email: tc.user.email,
                            });
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Service tables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {t.serviceTables} ({services.length})
          </CardTitle>
          <CardDescription>{t.serviceTablesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher}</TableHead>
                  <TableHead>{t.subject}</TableHead>
                  <TableHead>{t.classe}</TableHead>
                  <TableHead>{t.groupe}</TableHead>
                  <TableHead className="text-center">{t.hoursPerWeek}</TableHead>
                  <TableHead className="text-end">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.teacher.lastName} {s.teacher.firstName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.subject}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.classe.code}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.groupe ? (
                          <Badge variant="secondary">{s.groupe.code}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t.noGroup}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.hoursPerWeek}h
                        </span>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteService(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog : réinitialiser le mot de passe enseignant */}
      <Dialog open={!!pwdTarget} onOpenChange={(v) => !v && setPwdTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {t.resetPassword}
            </DialogTitle>
            <DialogDescription>
              {pwdTarget?.name} — {pwdTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={resetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tc-new-pwd">{t.newPassword}</Label>
              <Input
                id="tc-new-pwd"
                type="text"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwdTarget(null)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={pwdSaving || newPassword.length < 6}>
                {pwdSaving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <KeyRound className="h-4 w-4 me-2" />}
                {t.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TeacherDialog open={teacherOpen} onOpenChange={setTeacherOpen} onSaved={() => refresh()} subjects={SUBJECTS} />
      <ServiceDialog
        open={serviceOpen}
        onOpenChange={setServiceOpen}
        teachers={teachers}
        classes={classes}
        onSaved={() => refreshServices()}
        subjects={SUBJECTS}
      />

      {/* Import Teachers Preview Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {t.importTeachers}
            </DialogTitle>
            <DialogDescription>
              {previewRows.length} {t.rowsFound} — {t.emailAutoGenerated} ({t.passwordDefault} : enseignant123)
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t.status}</TableHead>
                  <TableHead>{t.lastName}</TableHead>
                  <TableHead>{t.firstName}</TableHead>
                  <TableHead>{t.subject}</TableHead>
                  <TableHead>{t.email}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r) => (
                  <TableRow key={r.index}>
                    <TableCell>
                      {r.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{r.lastName}</TableCell>
                    <TableCell>{r.firstName}</TableCell>
                    <TableCell>
                      {r.matiere ? (
                        <Badge variant="secondary">{r.matiere}</Badge>
                      ) : (
                        <span className="text-xs text-destructive">{t.errMatiereMissing}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.email}
                      {r.emailGenerated && (
                        <Badge variant="outline" className="ms-2 text-[10px] text-muted-foreground">auto</Badge>
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
            <Button onClick={commitImport} disabled={committing || previewRows.length === 0}>
              {committing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
              {t.confirmImport} ({previewRows.filter((r) => r.valid).length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeacherDialog({ open, onOpenChange, onSaved, subjects }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; subjects: typeof SUBJECTS }) {
  const { t } = useI18n();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matiere, setMatiere] = useState("");
  const [matiereAr, setMatiereAr] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const subj = subjects.find((s) => s.fr === matiere);
      await apiPost("/api/teachers", {
        firstName,
        lastName,
        matiere,
        matiereAr: subj?.ar || matiereAr,
        email,
        password,
      });
      toast.success(t.created);
      setFirstName(""); setLastName(""); setMatiere(""); setMatiereAr(""); setEmail(""); setPassword("");
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
            <UserPlus className="h-5 w-5 text-primary" />
            {t.createTeacher}
          </DialogTitle>
          <DialogDescription>{t.teachers}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tfn">{t.firstName}</Label>
              <Input id="tfn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tln">{t.lastName}</Label>
              <Input id="tln" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.subject}</Label>
            <Select value={matiere} onValueChange={(v) => { setMatiere(v); const s = subjects.find((x) => x.fr === v); if (s) setMatiereAr(s.ar); }}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectSubject} />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.fr} value={s.fr}>{s.fr} — {s.ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="te">{t.email}</Label>
              <Input id="te" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prof@edu.ma" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp">{t.password}</Label>
              <Input id="tp" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button type="submit" disabled={saving || !matiere}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({ open, onOpenChange, teachers, classes, onSaved, subjects }: { open: boolean; onOpenChange: (v: boolean) => void; teachers: any[]; classes: any[]; onSaved: () => void; subjects: typeof SUBJECTS }) {
  const { t } = useI18n();
  const [teacherId, setTeacherId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState("2");
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c.id === classeId);
  const groups = selectedClass?.groups ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const subj = subjects.find((s) => s.fr === subject);
      await apiPost("/api/service-tables", {
        teacherId,
        classeId,
        groupId: groupId || null,
        subject,
        subjectAr: subj?.ar || null,
        hoursPerWeek: parseInt(hours) || 2,
      });
      toast.success(t.created);
      setTeacherId(""); setClasseId(""); setGroupId(""); setSubject(""); setHours("2");
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
            <Layers className="h-5 w-5 text-primary" />
            {t.assignService}
          </DialogTitle>
          <DialogDescription>{t.serviceTablesDesc}</DialogDescription>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t.subject}</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectSubject} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.fr} value={s.fr}>{s.fr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sh">{t.hoursPerWeek}</Label>
              <Input id="sh" type="number" min="1" max="20" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button type="submit" disabled={saving || !teacherId || !classeId || !subject}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
