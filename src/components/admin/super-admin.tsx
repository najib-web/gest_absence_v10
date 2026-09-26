"use client";

// Administration centrale (SUPERADMIN) — création des établissements scolaires
// avec leur AREF (Académie Régionale) et leur DP (Direction Provinciale),
// affectation des comptes Directeurs. Surveillants, enseignants et élèves
// créés sous un directeur héritent automatiquement de son AREF et sa DP.

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { AppShell, type SessionUser, type NavItem } from "@/components/app-shell";
import { useFetch, apiPost, apiPatch, apiPut, apiDelete } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Loader2,
  Landmark,
  Building2,
  Users,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  School,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface DirecteurInfo {
  id: string;
  email: string;
  name: string;
}

interface EtabRow {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string;
  arefFr: string;
  arefAr: string;
  dpFr: string;
  dpAr: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  counts: { users: number; teachers: number; students: number; classes: number };
  directeurs: DirecteurInfo[];
}

interface EtablissementsData {
  etablissements: EtabRow[];
  stats: { etablissements: number; surveillants: number; enseignants: number; totalEleves: number; totalClasses: number };
}

export function SuperAdminDashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";
  const [active, setActive] = useState("overview");
  const { data, loading, refresh } = useFetch<EtablissementsData>("/api/admin/etablissements");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EtabRow | null>(null); // null = création
  const [directorTarget, setDirectorTarget] = useState<EtabRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EtabRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const etablissements = data?.etablissements ?? [];
  const stats = data?.stats;

  const navItems: NavItem[] = [
    { id: "overview", label: t.overview, icon: <Landmark className="h-4 w-4" /> },
    { id: "etablissements", label: t.etablissements, icon: <Building2 className="h-4 w-4" /> },
  ];

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(e: EtabRow) {
    setEditing(e);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/admin/etablissements/${deleteTarget.id}`);
      toast.success(t.etabDeleted);
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell user={user} navItems={navItems} activeId={active} onNavigate={setActive} onLogout={onLogout}>
      {active === "overview" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              {t.superAdmin}
            </h2>
            <p className="text-sm text-muted-foreground">{t.superAdminDesc}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={<Building2 className="h-5 w-5" />} label={t.statEtablissements} value={stats?.etablissements} />
            <StatCard icon={<UserCog className="h-5 w-5" />} label={t.statDirecteurs} value={etablissements.reduce((n, e) => n + e.directeurs.length, 0)} />
            <StatCard icon={<ShieldCheck className="h-5 w-5" />} label={t.statSurveillants} value={stats?.surveillants} />
            <StatCard icon={<GraduationCap className="h-5 w-5" />} label={t.statEnseignants} value={stats?.enseignants} />
            <StatCard icon={<Users className="h-5 w-5" />} label={t.statEleves} value={stats?.totalEleves} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-primary" />
                {t.etablissementsTitle}
              </CardTitle>
              <CardDescription>{t.etablissementsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {etablissements.slice(0, 6).map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {isAr ? e.nameAr : e.nameFr}{" "}
                      <Badge variant="outline" className="ms-1 text-[10px]">{e.code}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {isAr ? e.arefAr : e.arefFr} — {isAr ? e.dpAr : e.dpFr}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {e.counts.students} {t.students} · {e.counts.teachers} {t.teachers} · {e.counts.classes} {t.classes}
                  </div>
                </div>
              ))}
              {etablissements.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground py-4 text-center">{t.noData}</p>
              )}
              <Button size="sm" onClick={openCreate} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 me-2" />
                {t.addEtablissement}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "etablissements" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                {t.etablissementsTitle}
              </h2>
              <p className="text-sm text-muted-foreground">{t.etablissementsDesc}</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 me-2" />
              {t.addEtablissement}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.etablissement}</TableHead>
                      <TableHead>{t.aref}</TableHead>
                      <TableHead>{t.dp}</TableHead>
                      <TableHead>{t.directeur}</TableHead>
                      <TableHead className="text-center">{t.students}</TableHead>
                      <TableHead className="text-center">{t.teachers}</TableHead>
                      <TableHead className="text-center">{t.classes}</TableHead>
                      <TableHead className="text-end">{t.edit}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : etablissements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          {t.noData}
                        </TableCell>
                      </TableRow>
                    ) : (
                      etablissements.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="font-semibold">{isAr ? e.nameAr : e.nameFr}</div>
                            <div className="text-xs text-muted-foreground font-mono">{e.code}</div>
                          </TableCell>
                          <TableCell className="text-xs max-w-52 truncate" title={isAr ? e.arefAr : e.arefFr}>
                            {isAr ? e.arefAr : e.arefFr}
                          </TableCell>
                          <TableCell className="text-xs max-w-52 truncate" title={isAr ? e.dpAr : e.dpFr}>
                            {isAr ? e.dpAr : e.dpFr}
                          </TableCell>
                          <TableCell>
                            {e.directeurs.length === 0 ? (
                              <span className="text-xs text-muted-foreground">{t.noDirector}</span>
                            ) : (
                              <div className="text-xs space-y-0.5">
                                {e.directeurs.map((d) => (
                                  <div key={d.id}>
                                    <div className="font-medium">{d.name}</div>
                                    <div className="text-muted-foreground">{d.email}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{e.counts.students}</TableCell>
                          <TableCell className="text-center">{e.counts.teachers}</TableCell>
                          <TableCell className="text-center">{e.counts.classes}</TableCell>
                          <TableCell className="text-end">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title={t.assignDirector}
                                onClick={() => setDirectorTarget(e)}
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title={t.edit}
                                onClick={() => openEdit(e)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title={t.delete}
                                onClick={() => setDeleteTarget(e)}
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
        </div>
      )}

      {/* Dialog création / édition établissement */}
      <EtablissementDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
        onSaved={() => {
          setEditorOpen(false);
          refresh();
        }}
      />

      {/* Dialog affecter / réinitialiser un directeur */}
      <DirectorDialog
        target={directorTarget}
        onClose={() => setDirectorTarget(null)}
        onSaved={() => {
          setDirectorTarget(null);
          refresh();
        }}
      />

      {/* Confirmation de suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteEtablissement} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (isAr ? deleteTarget.nameAr : deleteTarget.nameFr)} —{" "}
              {deleteTarget && deleteTarget.code}
              <br />
              {t.etabDeleteBlocked}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Trash2 className="h-4 w-4 me-2" />}
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value ?? "—"}</div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Dialog création / édition d'un établissement
// ============================================================
function EtablissementDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: EtabRow | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!editing;

  const [code, setCode] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [arefFr, setArefFr] = useState("");
  const [arefAr, setArefAr] = useState("");
  const [dpFr, setDpFr] = useState("");
  const [dpAr, setDpAr] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Compte directeur (création uniquement)
  const [dirName, setDirName] = useState("");
  const [dirEmail, setDirEmail] = useState("");
  const [dirPwd, setDirPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setCode(editing?.code ?? "");
    setNameFr(editing?.nameFr ?? "");
    setNameAr(editing?.nameAr ?? "");
    setArefFr(editing?.arefFr ?? "");
    setArefAr(editing?.arefAr ?? "");
    setDpFr(editing?.dpFr ?? "");
    setDpAr(editing?.dpAr ?? "");
    setAddress(editing?.address ?? "");
    setPhone(editing?.phone ?? "");
    setEmail(editing?.email ?? "");
    setDirName("");
    setDirEmail("");
    setDirPwd("");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && editing) {
        await apiPatch(`/api/admin/etablissements/${editing.id}`, {
          code,
          nameFr,
          nameAr,
          arefFr,
          arefAr,
          dpFr,
          dpAr,
          address,
          phone,
          email,
        });
        toast.success(t.etabUpdated);
      } else {
        await apiPost("/api/admin/etablissements", {
          code,
          nameFr,
          nameAr,
          arefFr,
          arefAr,
          dpFr,
          dpAr,
          address,
          phone,
          email,
          directeur:
            dirEmail && dirPwd
              ? { name: dirName, email: dirEmail, password: dirPwd }
              : undefined,
        });
        toast.success(t.etabCreated);
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const valid = nameFr.trim() && nameAr.trim() && arefFr.trim() && arefAr.trim() && dpFr.trim() && dpAr.trim() && (!isEdit ? code.trim() : true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            {isEdit ? t.editEtablissement : t.addEtablissement}
          </DialogTitle>
          <DialogDescription>{t.etabHeaderHint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="et-code">{t.etabCode} *</Label>
              <Input
                id="et-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="LY-MA-001"
                required
                className="font-mono"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="et-namefr">{t.etabName} — {t.inFrench} *</Label>
              <Input id="et-namefr" value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Lycée Al Massira" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-namear" dir="rtl">{t.etabName} — {t.inArabic} *</Label>
              <Input id="et-namear" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="الثانوية المسيرة" required className="text-right" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-areffr">{t.aref} — {t.inFrench} *</Label>
              <Input id="et-areffr" value={arefFr} onChange={(e) => setArefFr(e.target.value)} placeholder="AREF de Fès-Meknès" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-arefar" dir="rtl">{t.aref} — {t.inArabic} *</Label>
              <Input id="et-arefar" dir="rtl" value={arefAr} onChange={(e) => setArefAr(e.target.value)} placeholder="الأكاديمية الجهوية فاس مكناس" required className="text-right" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-dpfr">{t.dp} — {t.inFrench} *</Label>
              <Input id="et-dpfr" value={dpFr} onChange={(e) => setDpFr(e.target.value)} placeholder="Direction Provinciale de Meknès" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-dpar" dir="rtl">{t.dp} — {t.inArabic} *</Label>
              <Input id="et-dpar" dir="rtl" value={dpAr} onChange={(e) => setDpAr(e.target.value)} placeholder="المديرية الإقليمية مكناس" required className="text-right" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="et-addr">{t.addressOptional}</Label>
              <Input id="et-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-phone">{t.phone}</Label>
              <Input id="et-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-email">{t.email}</Label>
              <Input id="et-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          </div>

          {!isEdit && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <UserCog className="h-4 w-4 text-primary" />
                    {t.directorAccount}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">{t.directorAccountDesc}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="dir-name">{t.fullName}</Label>
                    <Input id="dir-name" value={dirName} onChange={(e) => setDirName(e.target.value)} placeholder="M. Ahmed Alaoui" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dir-email">{t.email}</Label>
                    <Input id="dir-email" value={dirEmail} onChange={(e) => setDirEmail(e.target.value)} type="email" placeholder="directeur@aref.ma" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dir-pwd">{t.password}</Label>
                    <Input id="dir-pwd" value={dirPwd} onChange={(e) => setDirPwd(e.target.value)} type="text" placeholder="••••••" />
                  </div>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
              {isEdit ? t.save : t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Dialog affecter un directeur / réinitialiser son mot de passe
// ============================================================
function DirectorDialog({
  target,
  onClose,
  onSaved,
}: {
  target: EtabRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [resetPwd, setResetPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const [wasOpen, setWasOpen] = useState(false);
  if (target && !wasOpen) {
    setWasOpen(true);
    setName("");
    setEmail("");
    setPwd("");
    setResetPwd("");
  } else if (!target && wasOpen) {
    setWasOpen(false);
  }

  const existing = target?.directeurs ?? [];

  async function createDirector(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      await apiPost(`/api/admin/etablissements/${target.id}/directeur`, { name, email, password: pwd });
      toast.success(t.directorCreated);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(userId: string) {
    if (!target) return;
    setSaving(true);
    try {
      await apiPut(`/api/admin/etablissements/${target.id}/directeur`, { userId, password: resetPwd });
      toast.success(t.directorPwdReset);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            {t.directorAccount}
          </DialogTitle>
          <DialogDescription>
            {target && (
              <>
                {target.nameFr} — {target.code}
                <br />
                {t.directorAccountDesc}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {existing.length > 0 && (
            <div className="space-y-2">
              <Label>{t.directeur}</Label>
              {existing.map((d) => (
                <div key={d.id} className="rounded-md border p-3 space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">{d.name}</span>{" "}
                    <span className="text-muted-foreground">({d.email})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      value={resetPwd}
                      onChange={(e) => setResetPwd(e.target.value)}
                      type="text"
                      placeholder={t.newPassword}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs shrink-0"
                      disabled={saving || resetPwd.length < 6}
                      onClick={() => resetPassword(d.id)}
                    >
                      {t.resetPassword}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={createDirector} className="space-y-3">
            <Label>{t.assignDirector}</Label>
            <div className="space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.fullName} />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t.email} required />
              <Input value={pwd} onChange={(e) => setPwd(e.target.value)} type="text" placeholder={t.password} required />
            </div>
            <Button type="submit" disabled={saving || !email || pwd.length < 6} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
              {t.assignDirector}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
